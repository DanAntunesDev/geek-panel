import { useEffect, useState } from "react";
import { STREAMING_SERVICES } from "../../../shared/providers.js";
import type { AppConfig, PlaybackState, SecretStatus, StreamingServiceId } from "../../../shared/types.js";
import { AuthControls, describeError, NoticeLine, useAuth, type Notice } from "./auth.js";
import { Check, Field } from "./ui.js";

type Config = AppConfig;
const LINK_ERRORS = {
  "invalid-url": "link inválido para este serviço",
  "not-found": "não encontrei esse conteúdo",
  network: "sem conexão para consultar o link",
} as const;

function LinkField({
  service,
  url,
  enabled,
  onChange,
  persist,
}: {
  service: StreamingServiceId;
  url: string;
  enabled: boolean;
  onChange: (next: { url?: string; enabled?: boolean }) => void;
  persist: () => Promise<void>;
}) {
  const [notice, setNotice] = useState<Notice>(null);
  const [checking, setChecking] = useState(false);
  const [playing, setPlaying] = useState(false);

  async function play() {
    setPlaying(true);
    setNotice(null);
    try {
      await persist();
      await window.painelApi.playUrl(url);
      setNotice({ tone: "ok", text: "tocando no player" });
    } catch (error) {
      setNotice({ tone: "err", text: describeError(error) });
    } finally {
      setPlaying(false);
    }
  }

  async function validate() {
    setChecking(true);
    setNotice(null);
    try {
      const result = await window.painelApi.resolveMediaUrl(url);
      if (!result.ok) setNotice({ tone: "err", text: LINK_ERRORS[result.reason] });
      else if (service !== "youtubeMusic" && result.service !== service && !(service === "youtube" && result.service === "youtubeMusic")) {
        setNotice({ tone: "err", text: "este link é de outro serviço" });
      } else setNotice({ tone: "ok", text: `${result.title}${result.author ? ` — ${result.author}` : ""}` });
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <Check checked={enabled} onChange={(value) => onChange({ enabled: value })}>
        Usar esta fonte no player
      </Check>
      <div className="cfg-row">
        <Field label="Link de música, vídeo ou playlist (opcional)">
          <input
            className="px-input"
            value={url}
            spellCheck={false}
            placeholder="https://…"
            onChange={(event) => {
              onChange({ url: event.target.value });
              setNotice(null);
            }}
          />
        </Field>
        <button className="px-btn" type="button" disabled={url.trim() === "" || checking} onClick={validate}>
          {checking ? "…" : "VALIDAR"}
        </button>
        <button className="px-btn px-btn-primary" type="button" disabled={url.trim() === "" || !enabled || playing} onClick={play}>
          {playing ? "…" : "TOCAR"}
        </button>
      </div>
      <NoticeLine notice={notice} />
    </>
  );
}

export function MediaModule({ config, setConfig, persist }: { config: Config; setConfig: (next: Config) => void; persist: () => Promise<void> }) {
  const [system, setSystem] = useState<PlaybackState | null>(null);
  const spotify = useAuth("spotify", persist);
  const google = useAuth("google", persist);
  const [secret, setSecret] = useState<SecretStatus>({ configured: false, hint: null });
  const [secretInput, setSecretInput] = useState("");
  const [secretNotice, setSecretNotice] = useState<Notice>(null);

  useEffect(() => {
    window.painelApi.getPlayback().then(setSystem).catch(() => undefined);
    const unsubscribe = window.painelApi.onPlaybackUpdate(setSystem);
    window.painelApi.getSecretStatus("google:clientSecret").then(setSecret).catch(() => undefined);
    return unsubscribe;
  }, []);

  const media = config.media;
  const setMedia = (patch: Partial<Config["media"]>) => setConfig({ ...config, media: { ...media, ...patch } });
  const setSource = (id: StreamingServiceId, patch: { url?: string; enabled?: boolean }) =>
    setMedia({ sources: { ...media.sources, [id]: { ...media.sources[id], ...patch } } });
  const label = (id: StreamingServiceId) => STREAMING_SERVICES.find((service) => service.id === id)?.label ?? id;

  async function saveSecret() {
    try {
      await window.painelApi.setSecret("google:clientSecret", secretInput);
      setSecret(await window.painelApi.getSecretStatus("google:clientSecret"));
      setSecretInput("");
      setSecretNotice({ tone: "ok", text: "segredo guardado no cofre do sistema" });
    } catch (error) {
      setSecretNotice({ tone: "err", text: describeError(error) });
    }
  }

  let systemLine = "Desativado.";
  if (media.systemPlayers) {
    if (!system) systemLine = "Procurando players…";
    else if (!system.player) systemLine = system.warning ?? "Nenhum player tocando agora.";
    else systemLine = `${system.player}${system.media?.title ? `: ${system.media.title}` : ""}`;
  }

  return (
    <>
      <h3 className="cfg-sub">NESTE COMPUTADOR</h3>
      <Check checked={media.systemPlayers} onChange={(value) => setMedia({ systemPlayers: value })}>
        Controlar e mostrar os players abertos neste computador
      </Check>
      <p className="cfg-note">Agora: {systemLine}</p>

      <h3 className="cfg-sub">SPOTIFY</h3>
      <div className="cfg-service">
        <AuthControls
          auth={spotify}
          ready={media.spotifyClientId.trim() !== ""}
          readyHint="Informe o ID do aplicativo para conectar."
        />
        <div className="cfg-row">
          <Field label="ID do aplicativo (Client ID)">
            <input className="px-input" value={media.spotifyClientId} spellCheck={false} onChange={(event) => setMedia({ spotifyClientId: event.target.value })} />
          </Field>
        </div>
        <p className="cfg-note">No painel do Spotify, cadastre o endereço de retorno http://127.0.0.1:4615/callback.</p>
        <LinkField service="spotify" url={media.sources.spotify.url} enabled={media.sources.spotify.enabled} onChange={(patch) => setSource("spotify", patch)} persist={persist} />
      </div>

      <h3 className="cfg-sub">CONTA GOOGLE (YOUTUBE E YOUTUBE MUSIC)</h3>
      <div className="cfg-service">
        <AuthControls
          auth={google}
          ready={media.googleClientId.trim() !== "" && secret.configured}
          readyHint="Informe o ID e o segredo do aplicativo e guarde o segredo."
        />
        <div className="cfg-row">
          <Field label="ID do aplicativo (Client ID)">
            <input className="px-input" value={media.googleClientId} spellCheck={false} onChange={(event) => setMedia({ googleClientId: event.target.value })} />
          </Field>
        </div>
        <div className="cfg-row">
          <Field label={secret.configured ? `Segredo do aplicativo (guardado ${secret.hint ?? ""})` : "Segredo do aplicativo (Client Secret)"}>
            <input
              className="px-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={secretInput}
              placeholder={secret.configured ? "digite para substituir" : ""}
              onChange={(event) => setSecretInput(event.target.value)}
            />
          </Field>
          <button className="px-btn" type="button" disabled={secretInput.trim() === ""} onClick={saveSecret}>
            GUARDAR
          </button>
          {secret.configured ? (
            <button
              className="px-btn"
              type="button"
              onClick={async () => {
                await window.painelApi.clearSecret("google:clientSecret");
                setSecret({ configured: false, hint: null });
              }}
            >
              REMOVER
            </button>
          ) : null}
        </div>
        <NoticeLine notice={secretNotice} />
      </div>

      {(["youtubeMusic", "youtube"] as const).map((id) => (
        <div key={id}>
          <h3 className="cfg-sub">{label(id).toUpperCase()}</h3>
          <div className="cfg-service">
            <LinkField service={id} url={media.sources[id].url} enabled={media.sources[id].enabled} onChange={(patch) => setSource(id, patch)} persist={persist} />
          </div>
        </div>
      ))}
    </>
  );
}
