/// <reference types="vite/client" />
import { Device, Connection } from "../types";

// Key của bạn
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
    Trả lời ngắn gọn, chuyên nghiệp bằng tiếng Việt.
  `;

  try {
    // BƯỚC 1: LẤY DANH SÁCH MODEL HỢP LỆ VỚI KEY NÀY
    // (Tránh việc đoán mò tên model gây lỗi 404)
    const modelsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    
    if (!modelsResponse.ok) {
      throw new Error("API Key không hợp lệ hoặc lỗi mạng khi lấy danh sách Model.");
    }
    
    const modelsData = await modelsResponse.json();
    
    // Tìm model nào có chữ "flash" (nhanh/rẻ) hoặc "pro" và hỗ trợ generateContent
    // Ưu tiên Flash 1.5 -> Pro -> Bất kỳ cái nào chạy được
    const validModel = modelsData.models?.find((m: any) => 
      m.name.includes('gemini-1.5-flash') && m.supportedGenerationMethods?.includes('generateContent')
    ) || modelsData.models?.find((m: any) => 
      m.supportedGenerationMethods?.includes('generateContent')
    );

    if (!validModel) {
      throw new Error("Không tìm thấy Model nào khả dụng cho Key này.");
    }

    // Lấy tên chuẩn của model (ví dụ: models/gemini-1.5-flash-001)
    const modelName = validModel.name.replace('models/', '');
    console.log("Đang sử dụng Model:", modelName);

    // BƯỚC 2: GỌI API VỚI MODEL VỪA TÌM ĐƯỢC
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Lỗi khi gọi AI");
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    return text || "AI không trả về kết quả.";

  } catch (error) {
    console.error("Gemini Error:", error);
    return `Lỗi hệ thống: ${error instanceof Error ? error.message : "Không xác định"}. Hãy thử tạo API Key mới nếu lỗi vẫn còn.`;
  }
};