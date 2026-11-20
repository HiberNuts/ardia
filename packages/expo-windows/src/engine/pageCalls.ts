import type { DiscardOutcome, DiscardRefusal, NavigationEntry, PageCookie, SecurityInfo, WebViewNativeHandle } from "@ardia/ardiacore";
import { noteMissing } from "../missing";

export type PageCall = <Result = unknown>(key: string, method: string, args: Record<string, unknown>) => Promise<Result | null>;

export type EnginePageView = Required<WebViewNativeHandle>;
type AnsweredByTheView = "nativeTag" | "capturePicture" | "downloadFavicon" | "focusIfUnfocused";
type NotOnWindowsYet = keyof typeof NOT_ON_WINDOWS_YET;
export type EnginePageCalls = Omit<EnginePageView, AnsweredByTheView | NotOnWindowsYet>;

const answeredWithoutWindows =
  <Answer>(method: string, answer: Answer) =>
  async (..._asked: unknown[]): Promise<Answer> => {
    noteMissing(`<ArdiaWebView>.${method}`);
    return answer;
  };

export const NOT_ON_WINDOWS_YET = {
  downloadImage: answeredWithoutWindows("downloadImage", null),
  requestPictureInPicture: answeredWithoutWindows("requestPictureInPicture", false),
  takeControlPress: answeredWithoutWindows("takeControlPress", false),
  exitPictureInPicture: answeredWithoutWindows("exitPictureInPicture", undefined),
  resolvePasswordPrompt: answeredWithoutWindows("resolvePasswordPrompt", undefined),
  resolveAutofillPrompt: answeredWithoutWindows("resolveAutofillPrompt", undefined),
  answerAutofillPrompt: answeredWithoutWindows("answerAutofillPrompt", false),
  executeExtensionAction: answeredWithoutWindows("executeExtensionAction", null),
  resolveDisplayMedia: answeredWithoutWindows("resolveDisplayMedia", undefined),
  mediaCaptureSourceId: answeredWithoutWindows("mediaCaptureSourceId", null),
  notificationAction: answeredWithoutWindows("notificationAction", undefined),
} satisfies Partial<EnginePageView>;

const withNulls = (args: Record<string, unknown>) => Object.fromEntries(Object.entries(args).map(([name, value]) => [name, value ?? null]));

export function enginePageCalls(call: PageCall, key: string): EnginePageCalls {
  const ask = (method: string, args: Record<string, unknown> = {}) => call<Record<string, unknown>>(key, method, withNulls(args));
  const run = async (method: string, args?: Record<string, unknown>) => void (await ask(method, args));
  return {
    loadUrl: (url, userInitiated) => run("loadUrl", { url, userInitiated }),
    goBack: () => run("goBack"),
    goForward: () => run("goForward"),
    goToOffset: (offset) => run("goToOffset", { offset }),
    reload: () => run("reload"),
    forceReload: () => run("forceReload"),
    stopLoading: () => run("stopLoading"),
    focus: () => run("focus"),
    setMuted: (muted) => run("setMuted", { muted }),
    find: (text, forward, findNext) => run("find", { text, forward, findNext }),
    stopFinding: (clear) => run("stopFinding", { clear }),
    zoomStep: (direction) => run("zoomStep", { direction }),
    executeJavaScript: (code) => run("executeJavaScript", { code }),
    evaluate: async (code) => {
      const result = (await ask("evaluate", { code }))?.result;
      return typeof result === "string" ? result : null;
    },
    navigationEntries: async () => {
      const entries = (await ask("navigationEntries"))?.entries;
      return Array.isArray(entries) ? (entries as NavigationEntry[]) : [];
    },
    showDevTools: (panel) => run("showDevTools", { panel }),
    print: () => run("print"),
    runPageCommand: (name) => run("runPageCommand", { name }),
    getSecurityInfo: async () => {
      const reply = await ask("getSecurityInfo");
      return !reply || reply.info === null ? null : (reply as SecurityInfo);
    },
    mediaCommand: (action, seconds) => run("mediaCommand", { action, seconds }),
    clearSiteData: async () => ((await ask("clearSiteData")) as { cookies: number | false; storage: boolean } | null) ?? { cookies: false, storage: false },
    pageCookies: async (urls) => {
      const cookies = (await ask("pageCookies", { urls }))?.cookies;
      return Array.isArray(cookies) ? (cookies as PageCookie[]) : [];
    },
    openBlockedPopup: (id, always) => run("openBlockedPopup", { id, always }),
    discard: async (unload) => ((await ask("discard", { unload }))?.outcome as DiscardOutcome | undefined) ?? "refused",
    sleepIfHidden: async (seconds) => {
      const keptBy = (await ask("sleepIfHidden", { seconds }))?.keptBy;
      return Array.isArray(keptBy) ? (keptBy as DiscardRefusal[]) : [-1];
    },
    setFrozen: (frozen) => run("setFrozen", { frozen }),
    resolveUnresponsive: (terminate) => run("resolveUnresponsive", { terminate }),
  };
}
