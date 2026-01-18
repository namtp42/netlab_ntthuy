/// <reference types="vite/client" />
import { Device, Connection } from "../types";

// 👇 THAY KEY TỪ GMAIL KHÁC VÀO ĐÂY
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
    // Dùng model gemini-1.5-flash (Bản miễn phí tiêu chuẩn)
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

    // Bắt lỗi Quota (Hết tiền/Hết lượt)
    if (data.error) {
      if (data.error.message.includes('quota')) {
        return "⚠️ Hết hạn mức miễn phí (Quota Exceeded). Vui lòng đổi API Key từ một Gmail khác.";
      }
      throw new Error(data.error.message);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || "AI không phản hồi.";

  } catch (error) {
    console.error("Gemini Error:", error);
    return `Lỗi: ${error instanceof Error ? error.message : "Kết nối thất bại"}`;
  }
};