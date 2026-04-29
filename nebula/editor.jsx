// Neural OS v2 — UI: Sidebar, TopBar, NodePanel, EditorPanel
// Editor supporta: creazione/modifica nodi (con cluster), aggiunta/rimozione link, modifica link esistenti.
const { useState, useMemo, useEffect, useRef } = React;

function Sidebar({ data, activeCats, setActiveCats, searchQuery, setSearchQuery, totals, focusNode, openEditor, openClusterEditor }) {
  const cats = Object.entries(data.categories);
  const toggle = (key) => {
    const next = new Set(activeCats);
    if (key === "all") return setActiveCats(new Set(["all", ...Object.keys(data.categories)]));
    next.delete("all");
    if (next.has(key)) next.delete(key); else next.add(key);
    if (next.size === 0) next.add("all");
    setActiveCats(next);
  };
  const isActive = (k) => activeCats.has("all") || activeCats.has(k);

  // Lista cluster (i nodi che hanno almeno un figlio collegato a sé come cluster head)
  const clusterHeads = useMemo(() => {
    const ids = new Set();
    for (const n of data.nodes) if (n.cluster && n.cluster !== n.id) ids.add(n.cluster);
    return [...ids].map(id => data.nodes.find(n => n.id === id)).filter(Boolean);
  }, [data]);

  return (
    <div className="panel sidebar">
      <div className="brand">
        <div className="brand-mark"><span/></div>
        <div>
          <div className="brand-title">NEURAL OS</div>
          <div className="brand-sub">Sistema operativo personale · 3D</div>
        </div>
      </div>

      <div className="counts">
        <div className="count-row main" onClick={() => toggle("all")}>
          <span className="dot" style={{background:"#fff"}}/>
          <span>Tutti i nodi</span>
          <span className="num">{totals.nodes}</span>
        </div>
        {cats.filter(([k]) => k !== "hub").map(([k, c]) => (
          <div key={k} className={`count-row ${isActive(k) ? "on" : "off"}`} onClick={() => toggle(k)}>
            <span className="dot" style={{background:c.color, boxShadow:`0 0 10px ${c.color}`}}/>
            <span>{c.label}</span>
            <span className="num">{totals.byCat[k] || 0}</span>
          </div>
        ))}
      </div>

      <div className="search">
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cerca nel grafo…" spellCheck={false}/>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      </div>

      <div className="dual-btns">
        <button className="big-btn" onClick={openEditor}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          Aggiungi nodo / link
        </button>
        <button className="big-btn cluster" onClick={openClusterEditor} title="Crea una nuova sotto-nebulosa">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9" strokeDasharray="2 3"/></svg>
          Sotto-nebulosa
        </button>
      </div>

      <div className="quick-list">
        <div className="quick-title">CORE</div>
        {data.nodes.filter(n => ["hub","pluriagency","disfatti","thinkr","selekt","lorenzo_industrie","ai_local"].includes(n.id)).map(n => (
          <div key={n.id} className="quick-item" onClick={() => focusNode(n.id)}>
            <span className="dot" style={{background: data.categories[n.category].color, boxShadow:`0 0 8px ${data.categories[n.category].color}`}}/>
            <span className="qlabel">{n.label}</span>
          </div>
        ))}

        {clusterHeads.length > 0 && (
          <>
            <div className="quick-title" style={{marginTop:8}}>SOTTONEBULOSE</div>
            {clusterHeads.map(n => (
              <div key={n.id} className="quick-item" onClick={() => focusNode(n.id)}>
                <span className="dot" style={{background: data.categories[n.category].color, boxShadow:`0 0 8px ${data.categories[n.category].color}`}}/>
                <span className="qlabel">{n.label}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function TopBar({ totals, focusMode, setFocusMode, selectedId, onResetData }) {
  return (
    <div className="topbar">
      <div className="tb-left">
        <span className="kbd-mono">NEURAL OS</span>
        <span className="dim">/</span>
        <span className="dim">3D ecosistema</span>
      </div>
      <div className="tb-mid">
        <span className="pulse-dot"/>
        {totals.nodes} nodi · {totals.links} sinapsi · live
      </div>
      <div className="tb-right">
        <button className={`tb-btn ${focusMode ? "on" : ""}`} disabled={!selectedId} onClick={() => setFocusMode(v => !v)}>
          Focus {focusMode ? "ON" : ""}
        </button>
        <button className="tb-btn" onClick={onResetData} title="Ripristina i dati di default">Reset</button>
        <span className="hint">L-drag pianeti · R-drag pan · M-drag rotazione</span>
      </div>
    </div>
  );
}

function NodePanel({ data, node, onClose, focusNode, setFocusMode, focusMode, onEdit, onDelete }) {
  if (!node) return null;
  const cat = data.categories[node.category];
  const conns = data.links
    .filter(l => l.source === node.id || l.target === node.id)
    .map((l, i) => {
      const otherId = l.source === node.id ? l.target : l.source;
      const other = data.nodes.find(n => n.id === otherId);
      return { other, type: l.type, idx: i };
    })
    .filter(x => x.other);
  const cluster = node.cluster && node.cluster !== node.id ? data.nodes.find(n => n.id === node.cluster) : null;

  return (
    <div className="panel detail">
      <div className="detail-head">
        <div className="detail-cat" style={{borderColor: cat.color, color: cat.color, boxShadow:`inset 0 0 12px ${cat.color}33`}}>
          {cat.label.toUpperCase()}
        </div>
        <button className="x-btn" onClick={onClose} aria-label="Chiudi">✕</button>
      </div>
      <div className="detail-title-row">
        <div className="node-orb" style={{background:`radial-gradient(circle, ${cat.color}66, ${cat.color}00 70%)`, borderColor: cat.color, color: cat.color}}/>
        <h2>{node.label}</h2>
      </div>
      <div className="detail-id">id: <span>{node.id}</span> · type: <span>{node.type}</span> · size: <span>{node.size}</span></div>
      {cluster && (
        <div className="detail-id">cluster: <span>{cluster.label}</span></div>
      )}
      {node.description && <p className="detail-desc">{node.description}</p>}
      {node.url && (
        <a className="detail-url" href={node.url} target="_blank" rel="noopener noreferrer">
          <span>{node.url.replace(/^https?:\/\//,"")}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
        </a>
      )}
      <div className="detail-actions">
        <button className={`act-btn primary`} onClick={() => setFocusMode(true)}>{focusMode ? "Focus attivo" : "Focus su questo nodo"}</button>
        <button className="act-btn" onClick={() => onEdit(node)}>Modifica</button>
      </div>
      <div className="detail-section">
        <div className="section-title">Connessioni · {conns.length}</div>
        <div className="conn-list">
          {conns.map(({ other, type }) => {
            const oc = data.categories[other.category];
            return (
              <div key={other.id} className="conn-row" onClick={() => focusNode(other.id)}>
                <span className="dot" style={{background: oc.color, boxShadow:`0 0 8px ${oc.color}`}}/>
                <span className="cn-label">{other.label}</span>
                <span className="cn-type">{type}</span>
              </div>
            );
          })}
          {conns.length === 0 && <div className="empty">Nessuna connessione.</div>}
        </div>
      </div>
      {node.id !== "hub" && (
        <button className="danger-btn" onClick={() => onDelete(node)}>
          Elimina nodo
        </button>
      )}
    </div>
  );
}

// ---------- Editor: aggiungi/modifica nodi e link ----------
function EditorPanel({ data, onClose, onSave, editingNode, defaultConnect }) {
  const isEdit = !!editingNode;
  // tab: 'node' (campi nodo) | 'links' (gestione collegamenti del nodo) | 'newlink' (nuova connessione standalone)
  const [tab, setTab] = useState(isEdit ? "node" : "node");
  const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,40);

  // ---- node fields ----
  const [label, setLabel] = useState(editingNode?.label || "");
  const [id, setId] = useState(editingNode?.id || "");
  const [category, setCategory] = useState(editingNode?.category || "custom");
  const [size, setSize] = useState(editingNode?.size || 1.6);
  const [url, setUrl] = useState(editingNode?.url || "");
  const [description, setDescription] = useState(editingNode?.description || "");
  const [cluster, setCluster] = useState(editingNode?.cluster || "");

  // create-mode: connessioni iniziali
  const [connectIds, setConnectIds] = useState(new Set(defaultConnect ? [defaultConnect] : ["hub"]));
  const [linkType, setLinkType] = useState("custom");

  // ---- existing links of editing node (modifica/aggiungi/rimuovi) ----
  const existingLinks = useMemo(() => {
    if (!isEdit) return [];
    return data.links
      .map((l, i) => ({ ...l, _idx: i }))
      .filter(l => l.source === editingNode.id || l.target === editingNode.id);
  }, [data, editingNode, isEdit]);

  // local edits to existing links: mappa idx → { type } o "removed"
  const [linkPatches, setLinkPatches] = useState({});
  // nuovi link da aggiungere a questo nodo (in edit mode)
  const [pendingLinks, setPendingLinks] = useState([]); // [{target, type}]
  const [newLinkTarget, setNewLinkTarget] = useState("");
  const [newLinkType, setNewLinkType] = useState("custom");

  // ---- Standalone "new link" tab ----
  const [linkSource, setLinkSource] = useState(data.nodes[0]?.id || "");
  const [linkTarget, setLinkTarget] = useState("");
  const [linkTypeOnly, setLinkTypeOnly] = useState("custom");

  useEffect(() => {
    if (!isEdit && label) setId(slugify(label));
  }, [label, isEdit]);

  const toggleConnect = (nid) => {
    const next = new Set(connectIds);
    if (next.has(nid)) next.delete(nid); else next.add(nid);
    setConnectIds(next);
  };

  const submitNode = () => {
    if (!label.trim()) return alert("Inserisci un'etichetta.");
    let finalId = id.trim() || slugify(label);
    if (!isEdit && data.nodes.some(n => n.id === finalId)) {
      finalId = finalId + "_" + Math.random().toString(36).slice(2,5);
    }
    const node = {
      id: finalId,
      type: category,
      category,
      label: label.trim(),
      size: Number(size) || 1.6,
      url: url.trim() || undefined,
      description: description.trim() || undefined,
      cluster: cluster || undefined
    };

    if (isEdit) {
      onSave({
        kind: "edit_node",
        node,
        originalId: editingNode.id,
        linkPatches,        // { idx: {type} | "removed" }
        addLinks: pendingLinks.map(pl => ({ source: editingNode.id, target: pl.target, type: pl.type }))
      });
    } else {
      const newLinks = [...connectIds].map(target => ({ source: finalId, target, type: linkType }));
      onSave({ kind: "create_node", node, newLinks });
    }
  };

  const submitLink = () => {
    if (!linkSource || !linkTarget || linkSource === linkTarget) return alert("Seleziona due nodi diversi.");
    onSave({ kind: "link", link: { source: linkSource, target: linkTarget, type: linkTypeOnly } });
  };

  const patchLink = (idx, patch) => {
    setLinkPatches(prev => ({ ...prev, [idx]: { ...(prev[idx] === "removed" ? {} : prev[idx] || {}), ...patch } }));
  };
  const removeLink = (idx) => {
    setLinkPatches(prev => ({ ...prev, [idx]: "removed" }));
  };
  const restoreLink = (idx) => {
    setLinkPatches(prev => { const n = {...prev}; delete n[idx]; return n; });
  };
  const addPending = () => {
    if (!newLinkTarget) return;
    if (newLinkTarget === editingNode.id) return alert("Non puoi collegare un nodo a sé stesso.");
    if (existingLinks.some(l => (l.source === newLinkTarget || l.target === newLinkTarget))) {
      return alert("Esiste già una connessione con questo nodo.");
    }
    if (pendingLinks.some(p => p.target === newLinkTarget)) return;
    setPendingLinks([...pendingLinks, { target: newLinkTarget, type: newLinkType }]);
    setNewLinkTarget("");
  };
  const removePending = (target) => setPendingLinks(pendingLinks.filter(p => p.target !== target));

  const getLinkUI = (l) => {
    const otherId = l.source === editingNode.id ? l.target : l.source;
    const other = data.nodes.find(n => n.id === otherId);
    const removed = linkPatches[l._idx] === "removed";
    const currentType = (linkPatches[l._idx] && linkPatches[l._idx] !== "removed" && linkPatches[l._idx].type) || l.type;
    return { other, removed, currentType };
  };

  return (
    <div className="panel editor">
      <div className="editor-head">
        <div className="editor-title">{isEdit ? `Modifica · ${editingNode.label}` : "Aggiungi al grafo"}</div>
        <button className="x-btn" onClick={onClose}>✕</button>
      </div>

      <div className="tabs">
        <button className={`tab ${tab==="node"?"on":""}`} onClick={() => setTab("node")}>{isEdit ? "Dati nodo" : "Nuovo nodo"}</button>
        {isEdit && (
          <button className={`tab ${tab==="links"?"on":""}`} onClick={() => setTab("links")}>Collegamenti ({existingLinks.length + pendingLinks.length})</button>
        )}
        {!isEdit && (
          <button className={`tab ${tab==="newlink"?"on":""}`} onClick={() => setTab("newlink")}>Solo connessione</button>
        )}
      </div>

      {tab === "node" && (
        <div className="form">
          <label>Etichetta
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Es. Mio Progetto"/>
          </label>
          <label>ID {isEdit && <span className="hint-inline">(non modificabile)</span>}
            <input value={id} onChange={e => setId(slugify(e.target.value))} disabled={isEdit} placeholder="es. mio_progetto"/>
          </label>
          <label>Categoria
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {Object.entries(data.categories).filter(([k]) => k !== "hub").map(([k, c]) => (
                <option key={k} value={k}>{c.label}</option>
              ))}
            </select>
          </label>
          <label>Sotto-nebulosa (cluster)
            <select value={cluster} onChange={e => setCluster(e.target.value)}>
              <option value="">— nessuna (orbita libera) —</option>
              {data.nodes.filter(n => !isEdit || n.id !== editingNode.id).map(n => (
                <option key={n.id} value={n.id}>↳ dentro {n.label}</option>
              ))}
            </select>
            <span className="hint-inline" style={{marginTop:4}}>I nodi con la stessa sotto-nebulosa orbitano attorno al loro head.</span>
          </label>
          <label>URL (opzionale)
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."/>
          </label>
          <label>Dimensione · {Number(size).toFixed(1)}
            <input type="range" min="1" max="3" step="0.1" value={size} onChange={e => setSize(e.target.value)}/>
          </label>
          <label>Descrizione (opzionale)
            <textarea rows="3" value={description} onChange={e => setDescription(e.target.value)} placeholder="Cosa rappresenta questo nodo?"/>
          </label>
          {!isEdit && (
            <>
              <label>Tipo di collegamento iniziale
                <select value={linkType} onChange={e => setLinkType(e.target.value)}>
                  {Object.keys(data.linkTypes).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <div className="connect-block">
                <div className="connect-title">Collega a · {connectIds.size} selezionati</div>
                <div className="connect-grid">
                  {data.nodes.map(n => (
                    <div key={n.id} className={`chip ${connectIds.has(n.id) ? "on" : ""}`} onClick={() => toggleConnect(n.id)} style={{borderColor: connectIds.has(n.id) ? data.categories[n.category].color : undefined}}>
                      <span className="dot" style={{background: data.categories[n.category].color}}/>
                      {n.label}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="form-actions">
            <button className="act-btn" onClick={onClose}>Annulla</button>
            <button className="act-btn primary" onClick={submitNode}>{isEdit ? "Salva modifiche" : "Crea nodo"}</button>
          </div>
        </div>
      )}

      {isEdit && tab === "links" && (
        <div className="form">
          <div className="connect-title">Collegamenti esistenti</div>
          {existingLinks.length === 0 && <div className="empty">Nessuna connessione esistente.</div>}
          {existingLinks.map(l => {
            const { other, removed, currentType } = getLinkUI(l);
            if (!other) return null;
            const oc = data.categories[other.category];
            return (
              <div key={l._idx} className="link-edit-row" style={{opacity: removed ? 0.4 : 1}}>
                <span className="dot" style={{background: oc.color, boxShadow:`0 0 8px ${oc.color}`}}/>
                <span className="cn-label" style={{textDecoration: removed ? "line-through" : "none"}}>{other.label}</span>
                <select disabled={removed} value={currentType} onChange={e => patchLink(l._idx, { type: e.target.value })}>
                  {Object.keys(data.linkTypes).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                {removed
                  ? <button className="mini-btn" onClick={() => restoreLink(l._idx)}>↶</button>
                  : <button className="mini-btn danger" onClick={() => removeLink(l._idx)}>✕</button>}
              </div>
            );
          })}

          {pendingLinks.length > 0 && (
            <>
              <div className="connect-title" style={{marginTop:14}}>Da aggiungere</div>
              {pendingLinks.map(pl => {
                const other = data.nodes.find(n => n.id === pl.target);
                if (!other) return null;
                const oc = data.categories[other.category];
                return (
                  <div key={pl.target} className="link-edit-row pending">
                    <span className="dot" style={{background: oc.color, boxShadow:`0 0 8px ${oc.color}`}}/>
                    <span className="cn-label">{other.label}</span>
                    <select value={pl.type} onChange={e => setPendingLinks(pendingLinks.map(p => p.target === pl.target ? {...p, type: e.target.value} : p))}>
                      {Object.keys(data.linkTypes).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <button className="mini-btn danger" onClick={() => removePending(pl.target)}>✕</button>
                  </div>
                );
              })}
            </>
          )}

          <div className="connect-title" style={{marginTop:14}}>Aggiungi nuovo collegamento</div>
          <div className="add-link-row">
            <select value={newLinkTarget} onChange={e => setNewLinkTarget(e.target.value)}>
              <option value="">— scegli nodo —</option>
              {data.nodes.filter(n => n.id !== editingNode.id && !existingLinks.some(l => l.source === n.id || l.target === n.id) && !pendingLinks.some(p => p.target === n.id)).map(n => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
            <select value={newLinkType} onChange={e => setNewLinkType(e.target.value)}>
              {Object.keys(data.linkTypes).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <button className="mini-btn" onClick={addPending}>+</button>
          </div>

          <div className="form-actions" style={{marginTop:12}}>
            <button className="act-btn" onClick={onClose}>Annulla</button>
            <button className="act-btn primary" onClick={submitNode}>Salva tutto</button>
          </div>
        </div>
      )}

      {!isEdit && tab === "newlink" && (
        <div className="form">
          <label>Sorgente
            <select value={linkSource} onChange={e => setLinkSource(e.target.value)}>
              {data.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
          <label>Destinazione
            <select value={linkTarget} onChange={e => setLinkTarget(e.target.value)}>
              <option value="">— scegli —</option>
              {data.nodes.filter(n => n.id !== linkSource).map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
          <label>Tipo
            <select value={linkTypeOnly} onChange={e => setLinkTypeOnly(e.target.value)}>
              {Object.keys(data.linkTypes).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <div className="form-actions">
            <button className="act-btn" onClick={onClose}>Annulla</button>
            <button className="act-btn primary" onClick={submitLink}>Crea connessione</button>
          </div>
        </div>
      )}
    </div>
  );
}

window.Sidebar = Sidebar;
window.TopBar = TopBar;
window.NodePanel = NodePanel;
window.EditorPanel = EditorPanel;

// ---------- Cluster creator ----------
function ClusterCreator({ data, onClose, onSave }) {
  const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,40);
  const [label, setLabel] = useState("");
  const [id, setId] = useState("");
  const [category, setCategory] = useState("custom");
  const [size, setSize] = useState(2.0);
  const [description, setDescription] = useState("");
  const [linkToHub, setLinkToHub] = useState(true);
  const [linkType, setLinkType] = useState("core");
  const [memberIds, setMemberIds] = useState(new Set()); // nodi esistenti da spostare dentro

  useEffect(() => {
    if (label) setId(slugify(label));
  }, [label]);

  const toggleMember = (nid) => {
    const next = new Set(memberIds);
    if (next.has(nid)) next.delete(nid); else next.add(nid);
    setMemberIds(next);
  };

  const submit = () => {
    if (!label.trim()) return alert("Dai un nome alla sotto-nebulosa.");
    let finalId = id.trim() || slugify(label);
    if (data.nodes.some(n => n.id === finalId)) {
      finalId = finalId + "_" + Math.random().toString(36).slice(2,5);
    }
    const headNode = {
      id: finalId,
      type: "cluster",
      category,
      label: label.trim(),
      size: Number(size) || 2.0,
      description: description.trim() || undefined,
      isClusterHead: true
    };
    onSave({
      kind: "create_cluster",
      head: headNode,
      members: [...memberIds],
      linkToHub,
      linkType
    });
  };

  return (
    <div className="panel editor cluster-editor">
      <div className="editor-head">
        <div className="editor-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{verticalAlign:"middle", marginRight:6}}><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9" strokeDasharray="2 3"/></svg>
          Nuova sotto-nebulosa
        </div>
        <button className="x-btn" onClick={onClose}>✕</button>
      </div>

      <p className="editor-blurb">Una sotto-nebulosa è un nodo "head" attorno a cui altri nodi orbitano. Scegli il nome, opzionalmente collegala all'HUB, e seleziona quali nodi esistenti vivranno al suo interno.</p>

      <div className="form">
        <label>Nome
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Es. Marketing, Photo, Tech…"/>
        </label>
        <label>ID <span className="hint-inline">(automatico)</span>
          <input value={id} onChange={e => setId(slugify(e.target.value))} placeholder="es. marketing"/>
        </label>
        <label>Categoria / colore
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {Object.entries(data.categories).filter(([k]) => k !== "hub").map(([k, c]) => (
              <option key={k} value={k}>{c.label}</option>
            ))}
          </select>
        </label>
        <label>Dimensione head · {Number(size).toFixed(1)}
          <input type="range" min="1.5" max="3" step="0.1" value={size} onChange={e => setSize(e.target.value)}/>
        </label>
        <label>Descrizione (opzionale)
          <textarea rows="2" value={description} onChange={e => setDescription(e.target.value)} placeholder="Cosa raggruppa questa sotto-nebulosa?"/>
        </label>

        <label className="check-label">
          <input type="checkbox" checked={linkToHub} onChange={e => setLinkToHub(e.target.checked)}/>
          <span>Collega l'head all'HUB CENTRALE</span>
        </label>

        {linkToHub && (
          <label>Tipo collegamento all'HUB
            <select value={linkType} onChange={e => setLinkType(e.target.value)}>
              {Object.keys(data.linkTypes).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
        )}

        <div className="connect-block">
          <div className="connect-title">Sposta nodi esistenti dentro · {memberIds.size} selezionati</div>
          <div className="connect-grid">
            {data.nodes.filter(n => n.id !== "hub" && !n.isClusterHead).map(n => (
              <div key={n.id} className={`chip ${memberIds.has(n.id) ? "on" : ""}`} onClick={() => toggleMember(n.id)} style={{borderColor: memberIds.has(n.id) ? data.categories[n.category].color : undefined}}>
                <span className="dot" style={{background: data.categories[n.category].color}}/>
                {n.label}
                {n.cluster && <span className="chip-tag">in {data.nodes.find(x => x.id === n.cluster)?.label || "?"}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button className="act-btn" onClick={onClose}>Annulla</button>
          <button className="act-btn primary" onClick={submit}>Crea sotto-nebulosa</button>
        </div>
      </div>
    </div>
  );
}

window.ClusterCreator = ClusterCreator;
