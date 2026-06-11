// App shell: header, tabs, theme, tweaks
const { useState: useAppState, useEffect: useAppEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "appName": "SunnyHeron",
  "accent": "#3E9B8F",
  "radius": 18,
  "headingFont": "Albert Sans",
  "cozy": true,
  "celebrations": true
}/*EDITMODE-END*/;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "growth", label: "Growth" },
  { id: "holdings", label: "Holdings" },
  { id: "rebalance", label: "Rebalance" },
  { id: "import", label: "Import" }
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = useAppState(() => {
    const saved = localStorage.getItem("sg_tab");
    return TABS.some(x => x.id === saved) ? saved : "overview";
  });
  useAppEffect(() => { localStorage.setItem("sg_tab", tab); }, [tab]);

  useAppEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--accent", t.accent);
    r.setProperty("--radius", t.radius + "px");
    r.setProperty("--font-head", `"${t.headingFont}", sans-serif`);
    // derive soft/deep tints from accent via color-mix
    r.setProperty("--accent-soft", `color-mix(in oklch, ${t.accent} 14%, white)`);
    r.setProperty("--accent-deep", `color-mix(in oklch, ${t.accent} 78%, black)`);
    r.setProperty("--accent-faint", `color-mix(in oklch, ${t.accent} 7%, white)`);
  }, [t.accent, t.radius, t.headingFont]);

  const now = new Date();
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className={"app" + (t.cozy ? " cozy" : "") + (t.celebrations ? " party" : "")}>
      <header className="topbar" data-screen-label="Header">
        <div className="brand">
          <div className="brand-mark">
            <div className="brand-sun"></div>
            <div className="brand-wing"></div>
          </div>
          <div>
            <div className="brand-name">{t.appName}</div>
            <div className="brand-sub">Matheus &amp; Melanie</div>
          </div>
        </div>
        <div className="topbar-right">
          <Chip tone="soft">☁ Synced</Chip>
          <Chip tone="up">⚡ Prices live · {time}</Chip>
        </div>
      </header>

      <nav className="tabs" data-screen-label="Tabs">
        {TABS.map(x => (
          <button key={x.id} type="button"
                  className={"tab" + (tab === x.id ? " active" : "")}
                  onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </nav>

      <main data-screen-label={TABS.find(x => x.id === tab).label}>
        {tab === "overview" && <Overview />}
        {tab === "growth" && <Growth />}
        {tab === "holdings" && <Holdings />}
        {tab === "rebalance" && <Rebalance />}
        {tab === "import" && <ImportScreen />}
      </main>

      <TweaksPanel>
        <TweakSection label="Brand" />
        <TweakSelect label="App name" value={t.appName}
                     options={["SunnyHeron", "Seaglass", "Portfolio", "Nest"]}
                     onChange={v => setTweak("appName", v)} />
        <TweakColor label="Accent" value={t.accent}
                    options={["#3E9B8F", "#2A7A70", "#F0937A", "#6FA8B8"]}
                    onChange={v => setTweak("accent", v)} />
        <TweakSection label="Feel" />
        <TweakSlider label="Roundness" value={t.radius} min={6} max={28} unit="px"
                     onChange={v => setTweak("radius", v)} />
        <TweakRadio label="Heading font" value={t.headingFont}
                    options={["Albert Sans", "Outfit", "Sora"]}
                    onChange={v => setTweak("headingFont", v)} />
        <TweakToggle label="Cozy spacing" value={t.cozy}
                     onChange={v => setTweak("cozy", v)} />
        <TweakToggle label="Celebrations" value={t.celebrations}
                     onChange={v => setTweak("celebrations", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
