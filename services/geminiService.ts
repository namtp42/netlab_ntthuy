/// <reference types="vite/client" />
import { Device, Connection } from "../types";

// 👇 Dán Key của bạn vào đây (Key này đang SỐNG TỐT, đừng đổi nữa nhé)
const API_KEY = "AIzaSyCBRhYk-XlVqzug4N6pMzc-5ByMvy5n3wc"; 

export const getNetworkAdvice = async (nodes: Device[], links: Connection[], userQuery: string) => {
  const topologyInfo = {
    devices: nodes.map(n => ({ type: n.type, name: n.name, ip: n.ip, mac: n.mac })),
    connections: links.map(l => {
      const src = nodes.find(n => n.id === l.sourceId);
      const tgt = nodes.find(n => n.id === l.targetId);
      return `${src?.name} <-> ${tgt?.name}`;
    })
  };

  const promptText = `
    Bạn là chuyên gia mạng (CCNA). Sơ đồ mạng:
    ${JSON.stringify(topologyInfo)}
    Câu hỏi: "${userQuery}"
    Trả lời ngắn gọn, chuyên nghiệp bằng tiếng Việt.
  `;

  try {
    // 🟢 SỬ DỤNG MODEL "gemini-1.5-flash" (Miễn phí & Ổn định nhất)
    // Không dùng auto-detect nữa để tránh nó chọn nhầm hàng "VIP" tốn tiền
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        }),
      }
    );

    const data = await response.json();

    // Xử lý lỗi nếu có
    if (!response.ok) {
      // Nếu Flash bị lỗi (hiếm), thử fallback sang model "gemini-pro" cũ hơn
      if (data.error?.code === 404) {
         console.log("Flash không chạy, thử Gemini Pro...");
         return await tryGeminiPro(promptText); 
      }
      return `Lỗi từ Google: ${data.error?.message}`;
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI không phản hồi.";

  } catch (error) {
    console.error("Gemini Error:", error);
    return "Lỗi kết nối mạng.";
  }
};

// Hàm phụ: Dùng để cứu cánh nếu model Flash bị lỗi
async function tryGeminiPro(prompt: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Không có phản hồi.";
  } catch (e) {
    return "Hệ thống đang bận, vui lòng thử lại sau.";
  }
}