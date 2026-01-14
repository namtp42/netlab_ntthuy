
import { GoogleGenAI } from "@google/genai";
// Fixed imports: NetworkNode -> Device, NetworkLink -> Connection as per types.ts
import { Device, Connection } from "../types";

// Always initialize with the named parameter 'apiKey' and use process.env.API_KEY directly
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Phân tích sơ đồ mạng và đưa ra lời khuyên sử dụng Gemini API.
 */
export const getNetworkAdvice = async (nodes: Device[], links: Connection[], userQuery: string) => {
  const topologyInfo = {
    // Mapping properties from the Device interface
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
    // Directly call generateContent on the model using the recommended 'gemini-3-flash-preview' for basic text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // The .text property is used to retrieve the generated content directly (not a method)
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Xin lỗi, tôi gặp trục trặc khi phân tích mạng của bạn. Vui lòng thử lại.";
  }
};
