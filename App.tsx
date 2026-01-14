
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Monitor, Network, Trash2, Cable, Activity, Settings, Terminal, 
  Router as RouterIcon, Globe, Cloud, Zap, XCircle, ZoomIn, ZoomOut, 
  Smartphone, Tablet, Watch, Laptop, Wifi, Send, ChevronRight, Lock, WifiHigh,
  Cpu
} from 'lucide-react';
import { Device, DeviceType, Connection, Log, ToolMode, ChatMessage } from './types';
import { getNetworkAdvice } from './services/geminiService';

// --- Helpers ---
const generateMac = () => {
  const hex = "0123456789ABCDEF";
  let mac = "";
  for (let i = 0; i < 6; i++) {
    mac += hex.charAt(Math.floor(Math.random() * 16));
    mac += hex.charAt(Math.floor(Math.random() * 16));
    if (i < 5) mac += ":";
  }
  return mac;
};

const Led = ({ status }: { status: 'off' | 'on' | 'activity' | 'error' }) => {
  let color = 'bg-slate-800';
  if (status === 'on') color = 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]';
  if (status === 'activity') color = 'bg-yellow-400 animate-pulse';
  if (status === 'error') color = 'bg-red-500 animate-pulse';
  return <div className={`w-1.5 h-1.5 rounded-full ${color} transition-all duration-200 border border-slate-900`}></div>;
};

export default function NetworkLab() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [draggedDevice, setDraggedDevice] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<ToolMode>(ToolMode.MOVE);
  const [cableStart, setCableStart] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [isPingModalOpen, setIsPingModalOpen] = useState(false);
  const [pingTargetIP, setPingTargetIP] = useState('');
  const [zoom, setZoom] = useState(1);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Chào mừng bạn đến với NetLab Pro. Tôi có thể giúp bạn thiết kế và kiểm tra hệ thống mạng LAN/WAN này!' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);

  // --- Actions ---
  const addLog = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev.slice(-10), { id: Date.now(), text, type }]);
  };

  const addDevice = (type: DeviceType) => {
    const id = Date.now().toString();
    const count = devices.filter(d => d.type === type).length + 1;
    let name = '';
    let ports = 0;
    let ip = undefined;
    let ssid = undefined;
    let password = undefined;

    switch(type) {
      case 'pc': name = `PC-${count}`; ports = 1; ip = `192.168.1.${10 + count}`; break;
      case 'laptop': name = `Laptop-${count}`; ports = 1; ip = `192.168.1.${50 + count}`; break;
      case 'mobile': name = `Phone-${count}`; ports = 0; ip = `192.168.1.${100 + count}`; break;
      case 'tablet': name = `iPad-${count}`; ports = 0; ip = `192.168.1.${110 + count}`; break;
      case 'watch': name = `Watch-${count}`; ports = 0; ip = `192.168.1.${120 + count}`; break;
      case 'switch': name = `Switch-${count}`; ports = 24; break;
      case 'router': name = `Router-${count}`; ports = 4; ip = '192.168.1.1'; break;
      case 'access_point': 
        name = `AP-${count}`; 
        ports = 1; 
        ssid = `NetLab_WiFi_${count}`;
        password = 'admin';
        break;
      case 'modem': name = `Modem-${count}`; ports = 2; break;
      case 'isp': name = `ISP`; ports = 99; ip = '8.8.8.8'; break;
    }

    const newDevice: Device = {
      id, type, name, ports, ip, mac: generateMac(),
      x: type === 'isp' ? 800 : 300 + Math.random() * 200,
      y: type === 'isp' ? 100 : 150 + Math.random() * 200,
      ssid,
      password
    };

    setDevices([...devices, newDevice]);
    addLog(`Đã thêm ${newDevice.name}`, 'info');
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (mode === ToolMode.DELETE) {
      setDevices(devices.filter(d => d.id !== id));
      setConnections(connections.filter(c => c.sourceId !== id && c.targetId !== id));
      if (selectedDevice === id) setSelectedDevice(null);
      addLog('Đã xóa thiết bị', 'error');
      return;
    }

    if (mode === ToolMode.CABLE) {
      if (cableStart === null) {
        setCableStart(id);
        addLog('Chọn thiết bị đích...', 'info');
      } else {
        if (cableStart === id) {
          setCableStart(null);
          return;
        }

        // Logic check connections
        const sourceDev = devices.find(d => d.id === cableStart);
        const targetDev = devices.find(d => d.id === id);
        if (!sourceDev || !targetDev) return;

        // Check wireless
        const isWireless = ['mobile', 'tablet', 'watch'].includes(sourceDev.type) || ['mobile', 'tablet', 'watch'].includes(targetDev.type);
        const hasAP = sourceDev.type === 'access_point' || targetDev.type === 'access_point';
        
        if (isWireless && !hasAP) {
          addLog('Thiết bị di động chỉ kết nối được với Access Point!', 'error');
          setCableStart(null);
          return;
        }

        // Check ports
        const sourceConns = connections.filter(c => c.sourceId === cableStart || c.targetId === cableStart).length;
        const targetConns = connections.filter(c => c.sourceId === id || c.targetId === id).length;

        if (!isWireless) {
          if (sourceDev.ports !== 99 && sourceConns >= sourceDev.ports) {
            addLog(`${sourceDev.name} đã hết cổng kết nối!`, 'error');
            setCableStart(null);
            return;
          }
          if (targetDev.ports !== 99 && targetConns >= targetDev.ports) {
            addLog(`${targetDev.name} đã hết cổng kết nối!`, 'error');
            setCableStart(null);
            return;
          }
        }

        const newConn: Connection = { id: `${cableStart}-${id}`, sourceId: cableStart, targetId: id };
        setConnections([...connections, newConn]);
        setCableStart(null);
        addLog(isWireless ? 'Kết nối Wifi thành công!' : 'Cắm dây mạng thành công!', 'success');
      }
      return;
    }

    if (mode === ToolMode.MOVE) {
      setDraggedDevice(id);
      setSelectedDevice(id);
      const dev = devices.find(d => d.id === id);
      if (dev && workspaceRef.current) {
        const rect = workspaceRef.current.getBoundingClientRect();
        setOffset({ x: (e.clientX - rect.left) / zoom - dev.x, y: (e.clientY - rect.top) / zoom - dev.y });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedDevice && mode === ToolMode.MOVE && workspaceRef.current) {
      const rect = workspaceRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom - offset.x;
      const y = (e.clientY - rect.top) / zoom - offset.y;
      setDevices(devices.map(d => d.id === draggedDevice ? { ...d, x, y } : d));
    }
  };

  const handleMouseUp = () => setDraggedDevice(null);

  const checkConnectionToType = (startId: string, targetType: DeviceType) => {
    const queue = [startId];
    const visited = new Set<string>();
    visited.add(startId);
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentDev = devices.find(d => d.id === currentId);
      if (currentDev && currentDev.type === targetType) return true;
      const neighbors = connections
        .filter(c => c.sourceId === currentId || c.targetId === currentId)
        .map(c => c.sourceId === currentId ? c.targetId : c.sourceId);
      for (const nid of neighbors) {
        if (!visited.has(nid)) { visited.add(nid); queue.push(nid); }
      }
    }
    return false;
  };

  const runPing = () => {
    if (!selectedDevice) return;
    const source = devices.find(d => d.id === selectedDevice);
    if (!source) return;
    const target = devices.find(d => d.ip === pingTargetIP);
    addLog(`Pinging ${pingTargetIP} from ${source.name}...`, 'info');

    if (!target) {
      const canReachISP = checkConnectionToType(source.id, 'isp');
      if (canReachISP && pingTargetIP !== '127.0.0.1') {
        setTimeout(() => addLog(`Reply from ${pingTargetIP}: bytes=32 time=45ms (via Internet)`, 'success'), 800);
      } else {
        setTimeout(() => addLog(`Request timed out. (IP không tồn tại)`, 'error'), 1000);
      }
      return;
    }

    if (source.id === target.id) {
      setTimeout(() => addLog(`Reply from ${target.ip}: loopback <1ms`, 'success'), 300);
      return;
    }

    // BFS for path finding
    const queue = [source.id];
    const visited = new Set<string>();
    visited.add(source.id);
    let found = false;
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === target.id) { found = true; break; }
      connections
        .filter(c => c.sourceId === curr || c.targetId === curr)
        .map(c => c.sourceId === curr ? c.targetId : c.sourceId)
        .forEach(nid => { if (!visited.has(nid)) { visited.add(nid); queue.push(nid); } });
    }

    setTimeout(() => {
      if (found) addLog(`Reply from ${target.ip}: bytes=32 time=12ms TTL=64`, 'success');
      else addLog(`Destination host unreachable. (No path)`, 'error');
    }, 1000);
  };

  const askAssistant = async () => {
    if (!aiInput.trim()) return;
    const msg = aiInput;
    setAiInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    setIsAiLoading(true);

    // Transform devices/links to standard format for the service
    const nodes = devices.map(d => ({ ...d, label: d.name }));
    const links = connections.map(c => ({ ...c, sourceId: c.sourceId, targetId: c.targetId }));
    
    const advice = await getNetworkAdvice(nodes as any, links as any, msg);
    setChatHistory(prev => [...prev, { role: 'assistant', content: advice || 'Tôi chưa có câu trả lời phù hợp.' }]);
    setIsAiLoading(false);
  };

  const renderCables = () => {
    return connections.map(conn => {
      const src = devices.find(d => d.id === conn.sourceId);
      const tgt = devices.find(d => d.id === conn.targetId);
      if (!src || !tgt) return null;

      const getCenter = (d: Device) => {
        if (d.type === 'switch') return { x: d.x + 64, y: d.y + 24 };
        if (d.type === 'isp') return { x: d.x + 40, y: d.y + 40 };
        return { x: d.x + 32, y: d.y + 32 };
      };

      const p1 = getCenter(src);
      const p2 = getCenter(tgt);

      const isWan = src.type === 'isp' || tgt.type === 'isp' || src.type === 'modem' || tgt.type === 'modem';
      const isWireless = ['mobile', 'tablet', 'watch'].includes(src.type) || ['mobile', 'tablet', 'watch'].includes(tgt.type);
      
      let stroke = "#3b82f6";
      let dash = "";
      if (isWan) stroke = "#f59e0b";
      if (isWireless) { stroke = "#a855f7"; dash = "4,4"; }

      return (
        <g key={conn.id}>
          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth="3" strokeDasharray={dash} className="opacity-70" />
          {isWireless && (
            <circle cx={(p1.x + p2.x)/2} cy={(p1.y + p2.y)/2} r="4" fill="#a855f7" className="animate-ping opacity-50" />
          )}
        </g>
      );
    });
  };

  const currentSelected = devices.find(d => d.id === selectedDevice);

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden font-sans text-slate-100">
      {/* Sidebar: Thiết bị */}
      <aside className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col z-20 shadow-xl overflow-y-auto shrink-0">
        <div className="p-4 border-b border-slate-700 bg-slate-800/50 sticky top-0 z-10 backdrop-blur">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Activity className="text-blue-400 w-5 h-5" />
              <h1 className="font-bold text-lg tracking-tight uppercase">NetLab Pro</h1>
            </div>
            <div className="pl-7 -mt-0.5">
              <p className="text-[10px] text-slate-400 font-semibold leading-tight">Thiết kế bởi Nguyễn Thanh Thủy</p>
              <p className="text-[9px] text-slate-500 font-medium">Trường THPT Bình Phú - Bình Dương</p>
            </div>
          </div>
          
          <div className="flex bg-slate-900 p-1 rounded-lg gap-1 border border-slate-700">
            <button onClick={() => setMode(ToolMode.MOVE)} className={`flex-1 p-2 rounded flex justify-center ${mode === ToolMode.MOVE ? 'bg-blue-600' : 'hover:bg-slate-700'}`} title="Di chuyển"><Settings size={18} /></button>
            <button onClick={() => setMode(ToolMode.CABLE)} className={`flex-1 p-2 rounded flex justify-center ${mode === ToolMode.CABLE ? 'bg-blue-600' : 'hover:bg-slate-700'}`} title="Nối cáp"><Cable size={18} /></button>
            <button onClick={() => setMode(ToolMode.DELETE)} className={`flex-1 p-2 rounded flex justify-center ${mode === ToolMode.DELETE ? 'bg-red-600' : 'hover:bg-slate-700'}`} title="Xóa"><Trash2 size={18} /></button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          <section>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-widest">Máy trạm (Wired)</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addDevice('pc')} className="flex flex-col items-center p-2 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                <Monitor size={24} className="text-emerald-400 mb-1" />
                <span className="text-[10px]">Desktop PC</span>
              </button>
              <button onClick={() => addDevice('laptop')} className="flex flex-col items-center p-2 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                <Laptop size={24} className="text-emerald-400 mb-1" />
                <span className="text-[10px]">Laptop</span>
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-widest">Thiết bị di động</h2>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => addDevice('mobile')} className="flex flex-col items-center p-2 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                <Smartphone size={20} className="text-pink-400 mb-1" />
                <span className="text-[10px]">Phone</span>
              </button>
              <button onClick={() => addDevice('tablet')} className="flex flex-col items-center p-2 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                <Tablet size={20} className="text-pink-400 mb-1" />
                <span className="text-[10px]">iPad</span>
              </button>
              <button onClick={() => addDevice('watch')} className="flex flex-col items-center p-2 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                <Watch size={20} className="text-pink-400 mb-1" />
                <span className="text-[10px]">Watch</span>
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-widest">Hạ tầng mạng</h2>
            <div className="space-y-2">
              <button onClick={() => addDevice('router')} className="w-full flex items-center gap-3 p-3 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                <div className="bg-slate-900 p-2 rounded"><RouterIcon size={20} className="text-purple-400" /></div>
                <div className="text-left font-bold text-xs">Router Cisco</div>
              </button>
              <button onClick={() => addDevice('switch')} className="w-full flex items-center gap-3 p-3 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                <div className="bg-slate-900 p-2 rounded"><Network size={20} className="text-blue-400" /></div>
                <div className="text-left font-bold text-xs">Switch 24-Port</div>
              </button>
              <button onClick={() => addDevice('access_point')} className="w-full flex items-center gap-3 p-3 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                <div className="bg-slate-900 p-2 rounded"><Wifi size={20} className="text-purple-300" /></div>
                <div className="text-left font-bold text-xs">Access Point</div>
              </button>
              <button onClick={() => addDevice('modem')} className="w-full flex items-center gap-3 p-3 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                <div className="bg-slate-900 p-2 rounded"><Globe size={20} className="text-amber-400" /></div>
                <div className="text-left font-bold text-xs">Modem (DSL/Cable)</div>
              </button>
              <button onClick={() => addDevice('isp')} className="w-full flex items-center gap-3 p-3 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                <div className="bg-slate-900 p-2 rounded"><Cloud size={20} className="text-sky-400" /></div>
                <div className="text-left font-bold text-xs">Internet (ISP)</div>
              </button>
            </div>
          </section>

          {currentSelected && (
            <section className="bg-slate-900 p-4 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-[10px] font-bold text-blue-400 uppercase mb-3 flex items-center gap-2">
                <Settings size={12}/> Thuộc tính: {currentSelected.name}
              </h2>
              <div className="space-y-3">
                {currentSelected.ip !== undefined && (
                  <div>
                    <label className="block text-[9px] text-slate-500 font-bold mb-1 uppercase tracking-tight">ĐỊA CHỈ IP</label>
                    <input 
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-blue-300 focus:border-blue-500 outline-none"
                      value={currentSelected.ip}
                      onChange={(e) => setDevices(devices.map(d => d.id === currentSelected.id ? { ...d, ip: e.target.value } : d))}
                    />
                  </div>
                )}

                {/* --- Cấu hình Access Point --- */}
                {currentSelected.type === 'access_point' && (
                  <div className="pt-2 border-t border-slate-800 space-y-3">
                    <div>
                      <label className="flex items-center gap-1 text-[9px] text-slate-500 font-bold mb-1 uppercase tracking-tight">
                        <WifiHigh size={10} /> TÊN TRUY CẬP (SSID)
                      </label>
                      <input 
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-blue-300 focus:border-blue-500 outline-none"
                        value={currentSelected.ssid || ''}
                        onChange={(e) => setDevices(devices.map(d => d.id === currentSelected.id ? { ...d, ssid: e.target.value } : d))}
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-[9px] text-slate-500 font-bold mb-1 uppercase tracking-tight">
                        <Lock size={10} /> MẬT KHẨU WIFI
                      </label>
                      <input 
                        type="password"
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-blue-300 focus:border-blue-500 outline-none"
                        value={currentSelected.password || ''}
                        onChange={(e) => setDevices(devices.map(d => d.id === currentSelected.id ? { ...d, password: e.target.value } : d))}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[9px] text-slate-500 font-bold mb-1 uppercase tracking-tight">VẬT LÝ (MAC)</label>
                  <div className="bg-slate-800 p-2 rounded text-[10px] font-mono text-yellow-500/80">{currentSelected.mac}</div>
                </div>

                {['pc', 'laptop', 'router'].includes(currentSelected.type) && (
                  <button onClick={() => { setIsPingModalOpen(true); setLogs([]); }} className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                    <Terminal size={12} /> Giao diện CLI
                  </button>
                )}
                {currentSelected.type === 'switch' && (
                  <div className="mt-4">
                    <p className="text-[10px] font-bold text-slate-400 mb-2">MAC Table (CAM):</p>
                    <div className="bg-slate-800 rounded border border-slate-700 max-h-32 overflow-y-auto">
                      <table className="w-full text-[9px]">
                        <thead className="bg-slate-700 text-slate-400 sticky top-0">
                          <tr><th className="p-1 text-left pl-2">Port</th><th className="p-1 text-left">MAC Address</th></tr>
                        </thead>
                        <tbody>
                          {connections.filter(c => c.sourceId === selectedDevice || c.targetId === selectedDevice).map((c, i) => {
                            const otherId = c.sourceId === selectedDevice ? c.targetId : c.sourceId;
                            const dev = devices.find(d => d.id === otherId);
                            return dev ? (
                              <tr key={i} className="border-t border-slate-700/50">
                                <td className="p-1 pl-2 text-blue-400">Fa0/{i+1}</td>
                                <td className="p-1 font-mono text-slate-300">{dev.mac}</td>
                              </tr>
                            ) : null;
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-slate-900">
        {/* Toolbar Top */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center pointer-events-none">
          <div className="bg-slate-800/80 backdrop-blur px-4 py-2 rounded-full border border-slate-700 text-[10px] font-bold text-slate-400 flex items-center gap-4 pointer-events-auto">
             <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full animate-pulse ${mode === ToolMode.MOVE ? 'bg-blue-400' : mode === ToolMode.CABLE ? 'bg-amber-400' : 'bg-red-400'}`}></span>
                CHẾ ĐỘ: {mode.toUpperCase()}
             </div>
             <div className="w-px h-3 bg-slate-700"></div>
             <div>{devices.length} THIẾT BỊ | {connections.length} KẾT NỐI</div>
          </div>

          <div className="flex gap-2 pointer-events-auto">
            <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 shadow-xl"><ZoomOut size={16}/></button>
            <div className="bg-slate-800 px-3 flex items-center text-xs font-bold rounded-lg border border-slate-700">{Math.round(zoom * 100)}%</div>
            <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 shadow-xl"><ZoomIn size={16}/></button>
          </div>
        </div>

        {/* Workspace Canvas */}
        <div 
          ref={workspaceRef}
          className="flex-1 overflow-auto cursor-crosshair canvas-grid relative"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: '200%', height: '200%' }}>
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {renderCables()}
              {cableStart && (
                <line 
                  x1={devices.find(d => d.id === cableStart)!.x + 32} 
                  y1={devices.find(d => d.id === cableStart)!.y + 32} 
                  x2={0} y2={0} // Placeholder for dynamic line logic if needed
                  stroke="#60a5fa" strokeWidth="2" strokeDasharray="4,4" className="opacity-50"
                />
              )}
            </svg>

            {devices.map(device => {
              const isActive = connections.some(c => c.sourceId === device.id || c.targetId === device.id);
              return (
                <div 
                  key={device.id}
                  className={`absolute flex flex-col items-center select-none group transition-shadow ${draggedDevice === device.id ? 'z-50' : 'z-10'}`}
                  style={{ left: device.x, top: device.y }}
                  onMouseDown={(e) => handleMouseDown(e, device.id)}
                >
                  <div className={`p-2 rounded-xl border-2 transition-all ${
                    selectedDevice === device.id 
                      ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                      : cableStart === device.id
                      ? 'bg-amber-500/20 border-amber-500'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                  }`}>
                    {/* Visual rendering for each type */}
                    {device.type === 'switch' && (
                      <div className="w-32 h-12 flex flex-col justify-between p-1 bg-slate-900 rounded border border-slate-700">
                        <div className="text-[6px] text-center text-slate-500 font-bold">CISCO CATALYST 24P</div>
                        <div className="grid grid-cols-12 gap-0.5">
                          {[...Array(24)].map((_, i) => (
                            <div key={i} className="w-1.5 h-1.5 bg-black rounded-[1px] border border-slate-800 flex items-center justify-center">
                              {i < connections.filter(c => c.sourceId === device.id || c.targetId === device.id).length && (
                                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse-fast"></div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {device.type === 'pc' && <Monitor size={48} className="text-slate-300" />}
                    {device.type === 'laptop' && <Laptop size={48} className="text-slate-300" />}
                    {device.type === 'router' && <div className="w-14 h-14 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center"><RouterIcon size={32} className="text-purple-400" /></div>}
                    {device.type === 'access_point' && (
                      <div className="relative">
                        <Wifi size={40} className="text-purple-300" />
                        <div className="absolute -top-2 -right-2 w-1 h-6 bg-slate-500 rounded rotate-12"></div>
                        <div className="absolute -top-2 -left-2 w-1 h-6 bg-slate-500 rounded -rotate-12"></div>
                      </div>
                    )}
                    {device.type === 'isp' && <Cloud size={60} className="text-sky-400" />}
                    {['mobile', 'tablet', 'watch'].includes(device.type) && (
                      <div className="relative p-2">
                        {device.type === 'mobile' && <Smartphone size={28} className="text-pink-400" />}
                        {device.type === 'tablet' && <Tablet size={32} className="text-pink-400" />}
                        {device.type === 'watch' && <Watch size={20} className="text-pink-400" />}
                        {isActive && <div className="absolute -top-1 -right-1 bg-purple-500 rounded-full p-0.5"><Wifi size={8} className="text-white"/></div>}
                      </div>
                    )}
                    {device.type === 'modem' && (
                      <div className="w-16 h-12 bg-slate-900 border-2 border-slate-700 rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute top-1 left-1 flex gap-0.5">
                           <Led status={isActive ? 'on' : 'off'} />
                           <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                        </div>
                        <Globe size={24} className="text-amber-500/80 mb-0.5" />
                        <span className="font-black text-[7px] text-slate-500 tracking-tighter uppercase">Cable Modem</span>
                      </div>
                    )}

                    {/* Connection LED */}
                    {device.type !== 'switch' && device.type !== 'modem' && (
                      <div className="absolute bottom-1 right-1">
                        <Led status={isActive ? 'on' : 'off'} />
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-center">
                    <div className="text-[10px] font-bold bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700 truncate max-w-[80px] shadow-sm">{device.name}</div>
                    {device.ip && <div className="text-[8px] font-mono text-sky-300 mt-0.5">{device.ip}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PING Modal (CLI) */}
        {isPingModalOpen && currentSelected && (
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-slate-950 w-full max-w-2xl h-[500px] rounded-xl shadow-2xl border border-slate-700 flex flex-col font-mono overflow-hidden">
              <div className="bg-slate-900 p-3 border-b border-slate-800 flex justify-between items-center px-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-widest">
                  <Terminal size={14} className="text-emerald-500" /> CLI: {currentSelected.name}
                </div>
                <button onClick={() => setIsPingModalOpen(false)} className="text-slate-500 hover:text-red-400 transition-colors"><XCircle size={18}/></button>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto text-xs space-y-1 text-slate-300 scroll-smooth">
                <div className="text-slate-500 opacity-50 mb-4 italic">Cisco IOS Software, Version 15.2, Simulation Environment</div>
                {logs.map(log => (
                  <div key={log.id} className={log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-red-400' : 'text-slate-300'}>
                    <span className="text-slate-600 mr-2">[{new Date(log.id).toLocaleTimeString()}]</span>
                    {log.text}
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/50">
                   <span className="text-emerald-500 font-bold">{currentSelected.name}></span>
                   <span className="text-slate-500">ping</span>
                   <input 
                    autoFocus
                    className="bg-transparent border-none focus:ring-0 text-white flex-1 p-0 outline-none"
                    placeholder="192.168.1.1"
                    value={pingTargetIP}
                    onChange={(e) => setPingTargetIP(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runPing()}
                   />
                </div>
              </div>
              <div className="p-2 bg-slate-900/50 text-[10px] text-slate-500 text-center">Nhấn 'Enter' để thực hiện lệnh Ping</div>
            </div>
          </div>
        )}
      </main>

      {/* AI Assistant Sidebar */}
      <section className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col z-20 shadow-2xl shrink-0">
        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Trợ lý NetAI</h2>
              <div className="flex items-center gap-1 text-[8px] text-slate-500 uppercase font-bold tracking-widest">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div> Online
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/30">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-3 rounded-2xl text-xs shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-slate-800 border border-slate-700 text-slate-300 rounded-tl-none'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isAiLoading && (
             <div className="flex justify-start">
               <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-700 flex gap-1">
                 <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                 <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                 <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
               </div>
             </div>
          )}
        </div>

        <div className="p-4 bg-slate-800 border-t border-slate-700">
           <div className="relative">
             <input 
               type="text" 
               placeholder="Hỏi về cấu hình mạng..."
               className="w-full pl-4 pr-10 py-3 bg-slate-900 border-none rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
               value={aiInput}
               onChange={(e) => setAiInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && askAssistant()}
             />
             <button 
               onClick={askAssistant}
               disabled={isAiLoading || !aiInput.trim()}
               className="absolute right-2 top-2 p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg disabled:opacity-20 transition-all"
             >
               <Send size={16} />
             </button>
           </div>
           <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-[8px] text-slate-500 font-bold">GEMINI 2.0 FLASH</span>
              <button onClick={() => { setDevices([]); setConnections([]); setChatHistory([{ role: 'assistant', content: 'Đã làm mới phòng lab. Hãy bắt đầu kéo thiết bị mới nhé!' }]); }} className="text-[8px] text-red-400 font-bold uppercase hover:underline">Reset Lab</button>
           </div>
        </div>
      </section>
    </div>
  );
}
