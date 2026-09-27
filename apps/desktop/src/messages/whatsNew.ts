// "What's new" notes bundled with the app (ticket 145), keyed by app version then
// locale ("en" is the fallback). Shown once, the first launch after an update to a
// version listed here — works offline and in personal mode. Add an entry when
// cutting a release; versions without an entry show nothing.
export const WHATS_NEW: Record<string, Record<string, string[]>> = {
  "1.5.1": {
    en: [
      "Screenshot privacy mode: capture only the active window, and skip the apps you choose.",
      "Dashboard fixes and a new full-screen screenshot viewer.",
    ],
    vi: [
      "Chế độ riêng tư cho ảnh chụp: chỉ chụp cửa sổ đang dùng và bỏ qua các ứng dụng bạn chọn.",
      "Sửa lỗi bảng điều khiển và trình xem ảnh chụp toàn màn hình mới.",
    ],
    zh: [
      "截图隐私模式：只截取当前窗口，并跳过你选择的应用。",
      "仪表盘修复，以及全新的全屏截图查看器。",
    ],
    ja: [
      "スクリーンショットのプライバシーモード：アクティブなウィンドウのみを撮影し、選択したアプリはスキップします。",
      "ダッシュボードの修正と、新しい全画面スクリーンショットビューア。",
    ],
    id: [
      "Mode privasi tangkapan layar: hanya jendela aktif yang ditangkap, dan aplikasi pilihan Anda dilewati.",
      "Perbaikan dasbor dan penampil tangkapan layar layar penuh yang baru.",
    ],
    fr: [
      "Mode confidentialité des captures : seule la fenêtre active est capturée, et les applications choisies sont ignorées.",
      "Corrections du tableau de bord et nouvelle visionneuse de captures en plein écran.",
    ],
    es: [
      "Modo de privacidad de capturas: solo se captura la ventana activa y se omiten las aplicaciones que elijas.",
      "Correcciones del panel y un nuevo visor de capturas a pantalla completa.",
    ],
  },
};

export function whatsNewFor(version: string, locale: string): string[] | null {
  const entry = WHATS_NEW[version];
  if (!entry) return null;
  return entry[locale] ?? entry.en ?? null;
}
