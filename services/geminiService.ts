/// <reference types="vite/client" />
import { Device, Connection } from "../types";

// Key của bạn (Tôi đã lấy từ code bạn gửi)
const API_KEY = "AIzaSyDcqRd_IlFJouA03NISHXYWSOk-TLYpmas";

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
    
    Hãy trả lời ngắn gọn, chuyên nghiệp bằng tiếng Việt.
  `;

  try {
    // Dùng fetch trực tiếp, không qua thư viện SDK -> Tránh mọi lỗi tương thích
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: promptText }]
          }]
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Lỗi Google API:", errorData);
      throw new Error(errorData.error?.message || "Lỗi không xác định từ Google");
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error("Gemini Error:", error);
    return "Lỗi kết nối: " + (error instanceof Error ? error.message : "Vui lòng thử lại.");
  }
};