/* 멍동네 ↔ Supabase 연결
 * 멍동네 본문은 Claude 아티팩트의 claude.use("db" | "room" | "user" | "downloads")를 씁니다.
 * 이 파일은 같은 모양의 함수를 Supabase로 만들어 window.claude 자리에 꽂아 줍니다.
 * 그래서 본문 코드는 고치지 않고 그대로 GitHub Pages에서 돌아가요.
 */
(function () {
  "use strict";
  var CFG = window.MUNG_CONFIG || {};
  window.MUNG_HOSTED = true;
  if (!CFG.url || !CFG.anonKey || !window.supabase) {
    console.warn("[멍동네] config.js에 Supabase 주소와 키가 없어 혼자 산책 모드로 열려요.");
    return;
  }
  var sb = window.supabase.createClient(CFG.url, CFG.anonKey, { realtime: { params: { eventsPerSecond: 20 } } });

  // 로그인 없이 익명으로 입장 (브라우저에 기억돼서 다시 와도 같은 사람)
  var uidP = (async function () {
    try {
      var s = (await sb.auth.getSession()).data.session;
      if (!s) { var r = await sb.auth.signInAnonymously(); if (r.error) throw r.error; s = r.data.session; }
      return s && s.user ? s.user.id : null;
    } catch (e) { console.warn("[멍동네] 익명 입장 실패", e); return null; }
  })();

  var SHARED = ["wishes", "ornaments", "locks", "pals", "palJoins"];
  var err = function (e) { return { code: e && e.code === "42501" ? "permission_denied" : "error", message: e && e.message }; };

  // ---------- db: collection(path).doc(id).get/set/delete, collection(path).orderBy().limit().onSnapshot()
  var tableListeners = new Set(), tableChannel = null;
  function ensureTableChannel() {
    if (tableChannel) return;
    tableChannel = sb.channel("docs-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, function (p) {
        tableListeners.forEach(function (fn) { fn(p); });
      })
      .subscribe();
  }
  function collection(path) {
    var q = { order: null, lim: 300 };
    var api = {
      orderBy: function (f, dir) { q.order = { f: f, desc: dir === "desc" }; return api; },
      limit: function (n) { q.lim = n; return api; },
      doc: function (id) {
        return {
          get: async function () {
            var r = await sb.from("docs").select("data").eq("coll", path).eq("id", id).maybeSingle();
            if (r.error) throw err(r.error);
            var v = r.data ? r.data.data : undefined;
            return { exists: !!r.data, data: function () { return v; } };
          },
          set: async function (obj) {
            var uid = await uidP; if (!uid) throw { code: "not_granted" };
            var r = await sb.from("docs").upsert({ coll: path, id: id, data: obj, owner: uid, updated_at: new Date().toISOString() });
            if (r.error) throw err(r.error);
          },
          delete: async function () {
            var r = await sb.from("docs").delete().eq("coll", path).eq("id", id);
            if (r.error) throw err(r.error);
          }
        };
      },
      onSnapshot: function (cb, onErr) {
        var rows = new Map(), ready = false;
        var emit = function () {
          var arr = Array.from(rows.values());
          if (q.order) arr.sort(function (a, b) { var x = (a.data || {})[q.order.f] || 0, y = (b.data || {})[q.order.f] || 0; return q.order.desc ? y - x : x - y; });
          arr = arr.slice(0, q.lim);
          cb({ docs: arr.map(function (r) { return { id: r.id, data: function () { return r.data; } }; }) });
        };
        var listener = function (p) {
          var row = p.eventType === "DELETE" ? p.old : p.new;
          if (!row || row.coll !== path) return;
          if (p.eventType === "DELETE") rows.delete(row.id); else rows.set(row.id, { id: row.id, data: row.data });
          if (ready) emit();
        };
        tableListeners.add(listener); ensureTableChannel();
        (async function () {
          await uidP;
          var r = await sb.from("docs").select("id,data").eq("coll", path).limit(1000);
          if (r.error) { if (onErr) onErr(err(r.error)); return; }
          r.data.forEach(function (x) { if (!rows.has(x.id)) rows.set(x.id, { id: x.id, data: x.data }); });
          ready = true; emit();
        })();
        return function () { tableListeners.delete(listener); };
      }
    };
    return api;
  }
  var db = { collection: collection };

  // ---------- room: presence(obj) + onPeers(handler) using Supabase Realtime presence
  var tabId = Math.random().toString(36).slice(2, 12);
  var state = {}, handlers = [], chan = null, joined = false, trackT = 0, lastTrack = 0;
  function peersNow() {
    if (!chan) return [];
    var st = chan.presenceState(), out = [];
    Object.keys(st).forEach(function (key) {
      var metas = st[key] || [], m = metas[metas.length - 1] || {}, pres = {};
      Object.keys(m).forEach(function (k) { if (k !== "presence_ref" && k !== "_uid") pres[k] = m[k]; });
      out.push({ peer: key, kind: "viewer", sameTab: key === tabId, isMe: false, presence: pres, updatedAt: Date.now() });
    });
    return out;
  }
  function ensureRoom() {
    if (chan) return;
    chan = sb.channel("village", { config: { presence: { key: tabId } } });
    chan.on("presence", { event: "sync" }, function () {
      var peers = peersNow();
      handlers.forEach(function (h) { try { h({ peers: peers, joined: [], left: [], updated: [] }); } catch (e) {} });
    }).subscribe(function (status) {
      if (status === "SUBSCRIBED") { joined = true; flush(); }
    });
  }
  function flush() {
    if (!joined) return;
    clearTimeout(trackT);
    var wait = Math.max(0, 180 - (Date.now() - lastTrack));
    trackT = setTimeout(function () { lastTrack = Date.now(); chan.track(state); }, wait);
  }
  var room = {
    presence: async function (patch) {
      Object.keys(patch || {}).forEach(function (k) { if (patch[k] === null || patch[k] === undefined) delete state[k]; else state[k] = patch[k]; });
      ensureRoom(); flush();
    },
    onPeers: function (handler) { handlers.push(handler); ensureRoom(); return function () { handlers = handlers.filter(function (h) { return h !== handler; }); }; },
    peers: peersNow
  };

  var user = { id: function () { return uidP; }, isOwner: function () { return false; }, canEdit: function () { return false; } };

  var downloads = {
    save: async function (o) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(o.data); a.download = o.filename || "멍동네.png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }
  };

  var caps = { db: db, room: room, user: user, downloads: downloads };
  window.claude = { use: async function (name) { await uidP; return caps[name] || null; } };
})();
