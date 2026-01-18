/// <reference types="vite/client" />
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Device, Connection } from "../types";

// ⚠️ QUAN TRỌNG: Dán trực tiếp API Key của bạn vào giữa dấu ngoặc kép bên dưới
// Key bắt đầu bằng chữ "AIza..."
const API_KEY_HARDCODED = "AIzaSyDcqRd_IlFJouA03NISHXYWSOk-TLYpmas";

const genAI = new GoogleGenerativeAI(API_KEY_HARDCODED);

// Dùng model này. Nếu vẫn lỗi, thử đổi thành "gemini-pro"
// ❌ Cũ:
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ✅ Mới (Sửa thành gemini-pro):
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

export const getNetworkAdvice = async (nodes: Device[], links: Connection[], userQuery: string) => {
  const topologyInfo = {
    devices: nodes.map(n => ({ type: n.type, name: n.name, ip: n.ip, mac: n.mac })),
    connections: links.map(l => {
      const src = nodes.find(n => n.id === l.sourceId);
      const tgt = nodes.find(n => n.id === l.targetId);
      return `${src?.name} <-> ${tgt?.name}`;
    })
  };

  const prompt = `
    Bạn là một chuyên gia về mạng máy tính (CCNA/Network+). 
    Dưới đây là sơ đồ mạng hiện tại của người dùng:
    ${JSON.stringify(topologyInfo, null, 2)}

    Câu hỏi/Yêu cầu của người dùng: "${userQuery}"

    Hãy phân tích mạng này, kiểm tra xem việc kết nối LAN đã đúng chưa, tư vấn về cấu hình IP hoặc các bước tiếp theo để mạng hoạt động. Trả lời bằng tiếng Việt một cách chuyên nghiệp và dễ hiểu.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error Chi Tiết:", error);
    return "Lỗi kết nối AI: Vui lòng kiểm tra lại API Key.";
  }
};