panel.style = 'position:fixed;top:58px;bottom:24px;right:20px;background:rgba(255, 255, 255, 0.65);color:#1c1c1e;padding:20px;border-radius:24px;border:1px solid rgba(255,255,255,0.8);z-index:999999;font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;width:350px;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 20px 40px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5);';

panel.innerHTML = `
<div id="mainView" style="width:100%; box-sizing:border-box;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
    <div id="mainTitle" style="font-size:20px; font-weight:700; letter-spacing:-0.5px;">C-RET HUD</div>
    <button style="width:32px; height:32px; border:none; border-radius:10px; background:rgba(0,0,0,0.05); color:#1c1c1e; cursor:pointer; backdrop-filter:blur(10px);">⚙️</button>
  </div>
  
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
    <div style="background:rgba(255,255,255,0.5); border:1px solid rgba(255,255,255,0.8); border-radius:16px; padding:12px; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
      <div style="font-size:11px; color:#8e8e93; font-weight:600; text-transform:uppercase; margin-bottom:4px;">Останній Trigger</div>
      <div style="font-size:13px; font-weight:600; color:#1c1c1e;">+1 Ręcznie 11:45</div>
    </div>
    <div style="background:rgba(255,255,255,0.5); border:1px solid rgba(255,255,255,0.8); border-radius:16px; padding:12px; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
      <div style="font-size:11px; color:#8e8e93; font-weight:600; text-transform:uppercase; margin-bottom:4px;">Off Task</div>
      <div style="font-size:18px; font-weight:700; color:#34c759;">30:00</div>
    </div>
  </div>
  
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
    <div style="background:rgba(255,59,48,0.1); border:1px solid rgba(255,59,48,0.2); border-radius:16px; padding:14px; text-align:center;">
      <div style="font-size:11px; color:#ff3b30; font-weight:700; text-transform:uppercase; margin-bottom:4px;">Problem</div>
      <div style="font-size:24px; font-weight:700; color:#ff3b30;">2</div>
    </div>
    <div style="background:rgba(0,122,255,0.1); border:1px solid rgba(0,122,255,0.2); border-radius:16px; padding:14px; text-align:center;">
      <div style="font-size:11px; color:#007aff; font-weight:700; text-transform:uppercase; margin-bottom:4px;">Pozostało</div>
      <div style="font-size:24px; font-weight:700; color:#007aff;">284</div>
    </div>
  </div>

  <div style="background:rgba(255,255,255,0.4); border-radius:16px; padding:12px; border:1px solid rgba(255,255,255,0.6);">
    <div style="display:grid; grid-template-columns:45px 50px 35px 1fr; gap:8px; align-items:center; margin-bottom:12px;">
      <b style="font-size:13px; color:#8e8e93; font-weight:600;">7:30</b>
      <div style="background:#fff; border-radius:8px; padding:4px; text-align:center; font-weight:700; font-size:13px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">115</div>
      <div style="font-size:11px; color:#8e8e93;">/110</div>
      <div style="height:6px; background:rgba(0,0,0,0.05); border-radius:3px; overflow:hidden;">
        <div style="height:100%; width:100%; background:#34c759; border-radius:3px;"></div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:45px 50px 35px 1fr; gap:8px; align-items:center; margin-bottom:12px;">
      <b style="font-size:13px; color:#8e8e93; font-weight:600;">8:30</b>
      <div style="background:#fff; border-radius:8px; padding:4px; text-align:center; font-weight:700; font-size:13px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">42</div>
      <div style="font-size:11px; color:#8e8e93;">/220</div>
      <div style="height:6px; background:rgba(0,0,0,0.05); border-radius:3px; overflow:hidden;">
        <div style="height:100%; width:38%; background:#007aff; border-radius:3px;"></div>
      </div>
    </div>
  </div>
</div>
`;
