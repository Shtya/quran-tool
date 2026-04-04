export default function manifest() {
  return {
    name: "مصحف المراجعة",
    short_name: "مراجعة القرآن",
    description: "أداة ذكية لمراجعة وتحسين حفظ القرآن الكريم",
    start_url: "/",
    display: "standalone",
    background_color: "#FDFBF7",
    theme_color: "#1F7A63",
    orientation: "portrait",
    dir: "rtl",
    lang: "ar",
    icons: [
      {
        src: "logo-white.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "logo-white.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "logo-white.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}