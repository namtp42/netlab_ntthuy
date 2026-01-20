
import React, { useState, useRef } from 'react';
import { 
  Monitor, Network, Trash2, Cable, Activity, Settings, Terminal, 
  Router as RouterIcon, Globe, Cloud, ZoomIn, ZoomOut, 
  Smartphone, Tablet, Watch, Laptop, Wifi, XCircle, WifiHigh,
  Lock, Database, Key, ShieldCheck, AlertTriangle, Download, Camera
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { Device, DeviceType, Connection, Log, ToolMode } from './types';

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

const isWirelessClient = (type: DeviceType) => ['mobile', 'tablet', 'watch'].includes(type);

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
  const [isCapturing, setIsCapturing] = useState(false);

  // Wifi Auth States
  const [wifiAuthModal, setWifiAuthModal] = useState<{
    isOpen: boolean;
    sourceId: string;
    targetId: string;
    apId: string;
    ssid: string;
    password: string;
  }>({ isOpen: false, sourceId: '', targetId: '', apId: '', ssid: '', password: '' });

  // Delete Confirmation State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    deviceId: string | null;
  }>({ isOpen: false, deviceId: null });

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

  const finalizeConnection = (sourceId: string, targetId: string) => {
    const newConn: Connection = { id: `${sourceId}-${targetId}`, sourceId, targetId };
    setConnections(prev => [...prev, newConn]);
    setCableStart(null);
  };

  const finalizeDeleteDevice = () => {
    const id = deleteConfirmModal.deviceId;
    if (!id) return;

    setDevices(devices.filter(d => d.id !== id));
    setConnections(connections.filter(c => c.sourceId !== id && c.targetId !== id));
    if (selectedDevice === id) setSelectedDevice(null);
    addLog('Đã xóa thiết bị', 'error');
    setDeleteConfirmModal({ isOpen: false, deviceId: null });
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (mode === ToolMode.DELETE) {
      setDeleteConfirmModal({ isOpen: true, deviceId: id });
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

        const sourceDev = devices.find(d => d.id === cableStart);
        const targetDev = devices.find(d => d.id === id);
        if (!sourceDev || !targetDev) return;

        const isSourceWireless = isWirelessClient(sourceDev.type);
        const isTargetWireless = isWirelessClient(targetDev.type);
        const hasAPInvolved = sourceDev.type === 'access_point' || targetDev.type === 'access_point';
        const apDevice = sourceDev.type === 'access_point' ? sourceDev : (targetDev.type === 'access_point' ? targetDev : null);
        
        if (isSourceWireless || isTargetWireless) {
          if (!hasAPInvolved) {
            addLog('Thiết bị di động chỉ có thể kết nối không dây với Access Point!', 'error');
            setCableStart(null);
            return;
          }
          setWifiAuthModal({
            isOpen: true,
            sourceId: cableStart,
            targetId: id,
            apId: apDevice!.id,
            ssid: '',
            password: ''
          });
          return;
        } else {
          const sourceWiredCount = getWiredConnectionCount(cableStart);
          const targetWiredCount = getWiredConnectionCount(id);

          if (sourceDev.ports !== 99 && sourceWiredCount >= sourceDev.ports) {
            addLog(`${sourceDev.name} đã hết cổng LAN vật lý!`, 'error');
            setCableStart(null);
            return;
          }
          if (targetDev.ports !== 99 && targetWiredCount >= targetDev.ports) {
            addLog(`${targetDev.name} đã hết cổng LAN vật lý!`, 'error');
            setCableStart(null);
            return;
          }
        }

        finalizeConnection(cableStart, id);
        addLog('Cắm dây mạng thành công!', 'success');
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

  const handleWifiAuth = () => {
    const ap = devices.find(d => d.id === wifiAuthModal.apId);
    if (!ap) return;

    if (wifiAuthModal.ssid === ap.ssid && wifiAuthModal.password === ap.password) {
      finalizeConnection(wifiAuthModal.sourceId, wifiAuthModal.targetId);
      addLog(`Connected: Đã kết nối thành công tới ${ap.name}`, 'success');
      setWifiAuthModal({ ...wifiAuthModal, isOpen: false });
    } else {
      addLog('Lỗi: SSID hoặc Mật khẩu Wifi không chính xác!', 'error');
    }
  };

  const getWiredConnectionCount = (deviceId: string) => {
    return connections.filter(c => {
      if (c.sourceId !== deviceId && c.targetId !== deviceId) return false;
      const s = devices.find(d => d.id === c.sourceId);
      const t = devices.find(d => d.id === c.targetId);
      if (!s || !t) return false;
      return !isWirelessClient(s.type) && !isWirelessClient(t.type);
    }).length;
  };

  const handleDeleteConnection = (e: React.MouseEvent, connectionId: string) => {
    if (mode === ToolMode.DELETE) {
      e.stopPropagation();
      setConnections(connections.filter(c => c.id !== connectionId));
      addLog('Đã xóa cáp nối', 'error');
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

  const saveAsImage = async () => {
    if (!workspaceRef.current) return;
    setIsCapturing(true);
    addLog('Đang chuẩn bị ảnh sơ đồ...', 'info');

    try {
      // Create a temporary clone or adjust the capture to include full canvas
      const dataUrl = await toPng(workspaceRef.current, {
        cacheBust: true,
        backgroundColor: '#0f172a', // matches slate-900
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const link = document.createElement('a');
      link.download = `NetLab_Result_${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
      addLog('Đã lưu ảnh sơ đồ thành công!', 'success');
    } catch (err) {
      console.error(err);
      addLog('Lỗi khi xuất ảnh sơ đồ.', 'error');
    } finally {
      setIsCapturing(false);
    }
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
      const isWireless = isWirelessClient(src.type) || isWirelessClient(tgt.type);
      
      let stroke = "#3b82f6";
      let dash = "";
      if (isWan) stroke = "#f59e0b";
      if (isWireless) { stroke = "#a855f7"; dash = "4,4"; }

      return (
        <g 
          key={conn.id} 
          className={`${mode === ToolMode.DELETE ? 'cursor-pointer' : ''}`}
          onClick={(e) => handleDeleteConnection(e, conn.id)}
        >
          <line 
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} 
            stroke="transparent" 
            strokeWidth="15" 
            className="pointer-events-auto"
          />
          <line 
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} 
            stroke={stroke} 
            strokeWidth="3" 
            strokeDasharray={dash} 
            className={`opacity-70 transition-colors pointer-events-none ${mode === ToolMode.DELETE ? 'hover:stroke-red-500' : ''}`}
          />
          {isWireless && (
            <circle cx={(p1.x + p2.x)/2} cy={(p1.y + p2.y)/2} r="4" fill="#a855f7" className="animate-ping opacity-50" />
          )}
        </g>
      );
    });
  };

  const currentSelected = devices.find(d => d.id === selectedDevice);
  const isInternetConnected = currentSelected ? checkConnectionToType(currentSelected.id, 'isp') : false;

  const deviceToDelete = devices.find(d => d.id === deleteConfirmModal.deviceId);

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
                {['router', 'switch', 'access_point', 'modem'].includes(currentSelected.type) && (
                  <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Globe size={14} className={isInternetConnected ? 'text-green-400' : 'text-slate-500'} />
                      <span className="text-[10px] font-bold text-slate-300">INTERNET</span>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${isInternetConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {isInternetConnected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                )}

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

                {currentSelected.type === 'access_point' && (
                  <div className="pt-1 space-y-3">
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
                        <Lock size={10} /> MẬT KHẨU TRUY CẬP
                      </label>
                      <input 
                        type="password"
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-blue-300 focus:border-blue-500 outline-none"
                        value={currentSelected.password || ''}
                        placeholder="Để trống nếu không bảo mật"
                        onChange={(e) => setDevices(devices.map(d => d.id === currentSelected.id ? { ...d, password: e.target.value } : d))}
                      />
                    </div>
                  </div>
                )}

                {currentSelected.type === 'switch' && (
                   <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mb-1">
                        <Database size={12} className="text-blue-400" /> BẢNG ĐỊA CHỈ MAC (CAM)
                      </div>
                      <div className="bg-slate-950 rounded border border-slate-700 overflow-hidden max-h-40 overflow-y-auto shadow-inner">
                        <table className="w-full text-[9px] font-mono">
                          <thead className="bg-slate-800 text-slate-500 sticky top-0 border-b border-slate-700">
                            <tr>
                              <th className="p-1.5 text-left pl-2">Port</th>
                              <th className="p-1.5 text-left">MAC</th>
                              <th className="p-1.5 text-left">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {connections.filter(c => c.sourceId === selectedDevice || c.targetId === selectedDevice).length > 0 ? (
                              connections.filter(c => c.sourceId === selectedDevice || c.targetId === selectedDevice).map((c, i) => {
                                const otherId = c.sourceId === selectedDevice ? c.targetId : c.sourceId;
                                const dev = devices.find(d => d.id === otherId);
                                return dev ? (
                                  <tr key={i} className="border-t border-slate-900 hover:bg-slate-900/50 transition-colors">
                                    <td className="p-1.5 pl-2 text-blue-400 font-bold">Fa0/{i+1}</td>
                                    <td className="p-1.5 text-slate-300">{dev.mac}</td>
                                    <td className="p-1.5 text-slate-500 italic">Dynamic</td>
                                  </tr>
                                ) : null;
                              })
                            ) : (
                              <tr><td colSpan={3} className="p-4 text-center text-slate-600 italic">Trống</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                   </div>
                )}

                <div>
                  <label className="block text-[9px] text-slate-500 font-bold mb-1 uppercase tracking-tight">VẬT LÝ (MAC)</label>
                  <div className="bg-slate-800 p-2 rounded text-[10px] font-mono text-yellow-500/80">{currentSelected.mac}</div>
                </div>

                {['pc', 'laptop', 'router'].includes(currentSelected.type) && (
                  <button onClick={() => { setIsPingModalOpen(true); setLogs([]); }} className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg">
                    <Terminal size={12} /> Giao diện CLI
                  </button>
                )}
              </div>
            </section>
          )}

          <div className="pt-4 border-t border-slate-700">
            <button onClick={() => { setDevices([]); setConnections([]); addLog('Đã làm mới phòng lab', 'info'); }} className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 rounded text-[10px] font-bold uppercase tracking-wider text-red-400 transition-all active:scale-95">Làm mới phòng Lab</button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-slate-900">
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center pointer-events-none">
          <div className="bg-slate-800/80 backdrop-blur px-4 py-2 rounded-full border border-slate-700 text-[10px] font-bold text-slate-400 flex items-center gap-4 pointer-events-auto shadow-2xl">
             <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full animate-pulse ${mode === ToolMode.MOVE ? 'bg-blue-400' : mode === ToolMode.CABLE ? 'bg-amber-400' : 'bg-red-400'}`}></span>
                CHẾ ĐỘ: {mode.toUpperCase()}
             </div>
             <div className="w-px h-3 bg-slate-700"></div>
             <div>{devices.length} THIẾT BỊ | {connections.length} KẾT NỐI</div>
          </div>

          <div className="flex gap-2 pointer-events-auto">
            <button 
              onClick={saveAsImage} 
              disabled={isCapturing}
              className={`p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 shadow-xl transition-all active:scale-90 flex items-center gap-2 text-xs font-bold ${isCapturing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Camera size={16} className={isCapturing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">LƯU ẢNH SƠ ĐỒ</span>
            </button>
            <div className="w-px h-full bg-slate-700 mx-1"></div>
            <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 shadow-xl transition-all active:scale-90"><ZoomOut size={16}/></button>
            <div className="bg-slate-800 px-3 flex items-center text-xs font-bold rounded-lg border border-slate-700 shadow-xl">{Math.round(zoom * 100)}%</div>
            <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 shadow-xl transition-all active:scale-90"><ZoomIn size={16}/></button>
          </div>
        </div>

        <div 
          ref={workspaceRef}
          className="flex-1 overflow-auto cursor-crosshair canvas-grid relative"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: '200%', height: '200%' }}>
            <svg className="absolute top-0 left-0 w-full h-full">
              {renderCables()}
              {cableStart && (
                <line 
                  x1={devices.find(d => d.id === cableStart)!.x + 32} 
                  y1={devices.find(d => d.id === cableStart)!.y + 32} 
                  x2={0} y2={0} 
                  stroke="#60a5fa" strokeWidth="2" strokeDasharray="4,4" className="opacity-50 pointer-events-none"
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
                  <div className={`p-2 rounded-xl border-2 transition-all duration-300 ${
                    selectedDevice === device.id 
                      ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)] scale-110' 
                      : cableStart === device.id
                      ? 'bg-amber-500/20 border-amber-500 scale-105'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                  }`}>
                    {device.type === 'switch' && (
                      <div className="w-32 h-12 flex flex-col justify-between p-1 bg-slate-900 rounded border border-slate-700">
                        <div className="text-[6px] text-center text-slate-500 font-bold">CISCO CATALYST 24P</div>
                        <div className="grid grid-cols-12 gap-0.5">
                          {[...Array(24)].map((_, i) => (
                            <div key={i} className="w-1.5 h-1.5 bg-black rounded-[1px] border border-slate-800 flex items-center justify-center">
                              {i < getWiredConnectionCount(device.id) && (
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
                    {device.type === 'isp' && <Cloud size={60} className="text-sky-400 animate-bounce [animation-duration:3s]" />}
                    {isWirelessClient(device.type) && (
                      <div className="relative p-2">
                        {device.type === 'mobile' && <Smartphone size={28} className="text-pink-400" />}
                        {device.type === 'tablet' && <Tablet size={32} className="text-pink-400" />}
                        {device.type === 'watch' && <Watch size={20} className="text-pink-400" />}
                        {isActive && <div className="absolute -top-1 -right-1 bg-purple-500 rounded-full p-0.5 shadow-lg"><Wifi size={8} className="text-white"/></div>}
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

        {/* Modal: Delete Confirmation */}
        {deleteConfirmModal.isOpen && deviceToDelete && (
          <div className="absolute inset-0 bg-black/70 z-[110] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-red-500/30 overflow-hidden">
              <div className="bg-red-500/10 p-4 border-b border-red-500/20 flex items-center gap-3">
                <div className="bg-red-500/20 p-2 rounded-lg">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-red-200">Xác nhận xóa</h3>
                  <p className="text-[10px] text-red-400 uppercase tracking-widest font-bold">Thao tác không thể hoàn tác</p>
                </div>
              </div>
              
              <div className="p-6 space-y-4 text-center">
                <p className="text-xs text-slate-300">
                  Bạn có chắc chắn muốn xóa thiết bị <span className="text-white font-bold">{deviceToDelete.name}</span>? 
                  Mọi kết nối liên quan sẽ bị gỡ bỏ.
                </p>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setDeleteConfirmModal({ isOpen: false, deviceId: null })}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    onClick={finalizeDeleteDevice}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold shadow-lg shadow-red-900/40 transition-all active:scale-95"
                  >
                    Xác nhận xóa
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Wifi Authentication */}
        {wifiAuthModal.isOpen && (
          <div className="absolute inset-0 bg-black/70 z-[100] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
              <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center gap-3">
                <div className="bg-purple-500/20 p-2 rounded-lg">
                  <WifiHigh size={20} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Cấu hình Wifi</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Authentication Required</p>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[9px] text-slate-500 font-bold mb-1.5 uppercase tracking-widest">Tên mạng (SSID)</label>
                  <div className="relative">
                    <Wifi size={14} className="absolute left-3 top-3 text-slate-500" />
                    <input 
                      autoFocus
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:border-blue-500 outline-none transition-all"
                      placeholder="Nhập tên Wifi..."
                      value={wifiAuthModal.ssid}
                      onChange={(e) => setWifiAuthModal({ ...wifiAuthModal, ssid: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] text-slate-500 font-bold mb-1.5 uppercase tracking-widest">Mật khẩu Wifi</label>
                  <div className="relative">
                    <Key size={14} className="absolute left-3 top-3 text-slate-500" />
                    <input 
                      type="password"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:border-blue-500 outline-none transition-all"
                      placeholder="Nhập mật khẩu..."
                      value={wifiAuthModal.password}
                      onChange={(e) => setWifiAuthModal({ ...wifiAuthModal, password: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleWifiAuth()}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => { setWifiAuthModal({ ...wifiAuthModal, isOpen: false }); setCableStart(null); }}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    onClick={handleWifiAuth}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold shadow-lg shadow-blue-900/40 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={14} /> Kết nối
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isPingModalOpen && currentSelected && (
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
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
              <div className="p-2 bg-slate-900/50 text-[10px] text-slate-500 text-center uppercase tracking-widest font-bold">Nhấn 'Enter' để thực hiện lệnh Ping</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
