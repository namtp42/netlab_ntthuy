/// <reference types="vite/client" />
import { Device, Connection } from "../types";

// Key của bạn (Giữ nguyên, key này đã ngon rồi)
const API_KEY = "AIzaSyCBRhYk-XlVqzug4N6pMzc-5ByMvy5n3wc";

export const getNetworkAdvice = async (nodes: Device[], links: Connection[], userQuery: string) => {
  const topologyInfo = {
    devices: nodes.map(n => ({ type: n.type, name: n.name, ip: n.ip })),
    connections: links.map(l => "connected")
  };

  const promptText = `
    Bạn là chuyên gia mạng (CCNA). Sơ đồ:
    ${JSON.stringify(topologyInfo)}
    Câu hỏi: "${userQuery}"
    Trả lời ngắn gọn, chuyên nghiệp bằng tiếng Việt.
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          // 👇 THÊM ĐOẠN NÀY ĐỂ TẮT BỘ LỌC AN TOÀN (Để AI dám trả lời về mạng/IP/Password)
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
       return `Lỗi Google: ${data.error?.message}`;
    }

    // Kiểm tra xem AI có bị chặn không
    if (data.promptFeedback?.blockReason) {
        return "AI từ chối trả lời vì lý do an toàn (Safety Filter).";
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI không phản hồi (Trả về rỗng).";

  } catch (error) {
    console.error("Lỗi:", error);
    return "Lỗi kết nối mạng.";
  }
};