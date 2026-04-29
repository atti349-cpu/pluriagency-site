// Neural OS v2 — dataset + persistenza localStorage
window.NEURAL_DATA_DEFAULT = {
  categories: {
    hub:      { label: "Hub",      color: "#ffffff" },
    business: { label: "Business", color: "#3B82F6" },
    creative: { label: "Creative", color: "#EC4899" },
    startup:  { label: "Startup",  color: "#8B5CF6" },
    infra:    { label: "Infra",    color: "#10B981" },
    social:   { label: "Social",   color: "#60A5FA" },
    ops:      { label: "Ops",      color: "#F59E0B" },
    ai:       { label: "AI",       color: "#34D399" },
    future:   { label: "Future",   color: "#A78BFA" },
    custom:   { label: "Custom",   color: "#F472B6" }
  },
  linkTypes: {
    core:    { color: "#ffffff", pulse: 1.0 },
    uses:    { color: "#94a3b8", pulse: 0.5 },
    future:  { color: "#A78BFA", pulse: 0.4, dashed: true },
    social:  { color: "#F472B6", pulse: 0.4 },
    infra:   { color: "#10B981", pulse: 0.4 },
    hosted:  { color: "#10B981", pulse: 0.3, dashed: true },
    related: { color: "#EC4899", pulse: 0.5 },
    ops:     { color: "#F59E0B", pulse: 0.5 },
    custom:  { color: "#F472B6", pulse: 0.6 }
  },
  nodes: [
    { id: "hub",               type: "hub",      category: "hub",      label: "HUB CENTRALE",      size: 3.0, description: "Sistema operativo personale — punto di accesso a tutto l'ecosistema." },
    { id: "pluriagency",       type: "website",  category: "business", label: "Pluriagency",       size: 2.2, url: "https://pluriagency.com",     description: "Core business marketing — acquisizione clienti, siti web, branding, contenuti, consulenza." },
    { id: "lorenzo_industrie", type: "website",  category: "business", label: "Lorenzo Industrie", size: 2.0, url: "https://lo.pluriagency.com",  description: "Sito B2B — vendita prodotti industria, intermediazione fornitori." },
    { id: "disfatti",          type: "website",  category: "creative", label: "DISF.ATTI",         size: 2.2, url: "https://www.disfatti.it",     description: "Progetto artistico — portfolio fotografico, identità creativa, storytelling visivo." },
    { id: "selekt",            type: "website",  category: "creative", label: "Selekt Photo",      size: 2.0, url: "https://selektphoto.com",     description: "Strumento selezione immagini per fotografi e clienti — portfolio, selezione, pagamenti." },
    { id: "thinkr",            type: "startup",  category: "startup",  label: "Thinkr",            size: 2.2, url: "https://thinkr.it",           description: "Piattaforma idee — matching co-founder, creazione progetti, profili, ranking, AI." },
    { id: "crm",               type: "tool",     category: "ops",      label: "CRM / Admin",       size: 1.7, cluster: "pluriagency", description: "Database clienti e fornitori condiviso tra Pluriagency e Lorenzo Industrie." },
    { id: "supabase",          type: "infra",    category: "infra",    label: "Supabase",          size: 1.6, description: "Database + auth — infrastruttura comune a tutto l'ecosistema." },
    { id: "vercel",            type: "infra",    category: "infra",    label: "Vercel",            size: 1.5, description: "Hosting e deployment — tutti i siti dell'ecosistema." },
    { id: "github",            type: "infra",    category: "infra",    label: "GitHub",            size: 1.5, description: "Versionamento codice — tutti i repository dell'ecosistema." },
    { id: "ai_local",          type: "future",   category: "future",   label: "AI Assistant Locale", size: 1.9, description: "Chatbot AI in sviluppo — aggregatore dati, interfaccia intelligente." },
    { id: "linkedin_personal", type: "social",   category: "social",   label: "LinkedIn",          size: 1.4, url: "https://linkedin.com",        description: "Profilo principale — centrale per Lorenzo Industrie e Pluriagency." },
    { id: "instagram_disfatti",type: "social",   category: "social",   label: "Instagram Disfatti",size: 1.3, cluster: "disfatti", description: "Account fotografico attivo — storytelling visivo personale." },
    { id: "gdrive",            type: "tool",     category: "ops",      label: "Google Drive",      size: 1.3, description: "File operativi — documenti, asset, organizzazione quotidiana." },
    { id: "calendly",          type: "tool",     category: "ops",      label: "Calendly",          size: 1.2, cluster: "pluriagency", description: "Gestione call clienti — collegato a Pluriagency." },
    { id: "chatgpt",           type: "tool",     category: "ai",       label: "ChatGPT",           size: 1.3, cluster: "ai_local", description: "AI tool principale per sviluppo, copy, strategia." },
    { id: "claude",            type: "tool",     category: "ai",       label: "Claude",            size: 1.3, cluster: "ai_local", description: "AI tool per coding, analisi, architettura sistemi." }
  ],
  links: [
    { source: "hub", target: "pluriagency",       type: "core" },
    { source: "hub", target: "disfatti",          type: "core" },
    { source: "hub", target: "thinkr",            type: "core" },
    { source: "hub", target: "selekt",            type: "core" },
    { source: "hub", target: "lorenzo_industrie", type: "core" },
    { source: "hub", target: "ai_local",          type: "future" },
    { source: "hub", target: "gdrive",            type: "ops" },
    { source: "hub", target: "github",            type: "ops" },
    { source: "pluriagency", target: "crm",               type: "uses" },
    { source: "pluriagency", target: "calendly",          type: "uses" },
    { source: "pluriagency", target: "linkedin_personal", type: "social" },
    { source: "lorenzo_industrie", target: "crm",               type: "uses" },
    { source: "lorenzo_industrie", target: "linkedin_personal", type: "social" },
    { source: "disfatti", target: "selekt",              type: "related" },
    { source: "disfatti", target: "instagram_disfatti",  type: "social" },
    { source: "selekt",   target: "supabase",            type: "uses" },
    { source: "thinkr",   target: "supabase",            type: "uses" },
    { source: "thinkr",   target: "ai_local",            type: "future" },
    { source: "pluriagency",       target: "vercel", type: "hosted" },
    { source: "disfatti",          target: "vercel", type: "hosted" },
    { source: "selekt",            target: "vercel", type: "hosted" },
    { source: "thinkr",            target: "vercel", type: "hosted" },
    { source: "supabase", target: "vercel", type: "infra" },
    { source: "github",   target: "vercel", type: "infra" },
    { source: "crm",      target: "supabase", type: "uses" },
    { source: "ai_local", target: "supabase", type: "future" },
    { source: "ai_local", target: "claude",   type: "uses" },
    { source: "ai_local", target: "chatgpt",  type: "uses" }
  ]
};

const STORAGE_KEY = "neural_os_data_v2";

window.loadNeuralData = function() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // merge default categories/linkTypes (in caso aggiunte successive)
      return {
        categories: { ...window.NEURAL_DATA_DEFAULT.categories, ...(parsed.categories || {}) },
        linkTypes:  { ...window.NEURAL_DATA_DEFAULT.linkTypes,  ...(parsed.linkTypes  || {}) },
        nodes: parsed.nodes || window.NEURAL_DATA_DEFAULT.nodes,
        links: parsed.links || window.NEURAL_DATA_DEFAULT.links
      };
    }
  } catch (e) { console.warn("loadNeuralData failed", e); }
  return JSON.parse(JSON.stringify(window.NEURAL_DATA_DEFAULT));
};

window.saveNeuralData = function(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { console.warn(e); }
};

window.resetNeuralData = function() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  return JSON.parse(JSON.stringify(window.NEURAL_DATA_DEFAULT));
};
