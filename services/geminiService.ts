/// <reference types="vite/client" />
import { Device, Connection } from "../types";

// 👇 Dán Key mới của bạn vào đây (Key lấy từ Gmail khác)
const API_KEY = "AIzaSy..........................."; 

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
    // BƯỚC 1: LẤY DANH SÁCH MODEL MÀ KEY NÀY ĐƯỢC PHÉP DÙNG
    const modelsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    
    if (!modelsResponse.ok) {
      throw new Error("API Key không hợp lệ hoặc chưa bật Google AI Studio.");
    }
    
    const modelsData = await modelsResponse.json();
    
    // Tìm model nào hỗ trợ tạo nội dung (generateContent)
    // Ưu tiên tìm thằng 'gemini-1.5-flash' -> nếu không có thì lấy 'gemini-pro' -> không có nữa thì lấy thằng đầu tiên tìm thấy
    const validModel = modelsData.models?.find((m: any) => 
      m.name.includes('gemini-1.5-flash') && m.supportedGenerationMethods?.includes('generateContent')
    ) || modelsData.models?.find((m: any) => 
      m.name.includes('gemini-pro') && m.supportedGenerationMethods?.includes('generateContent')
    ) || modelsData.models?.find((m: any) => 
      m.supportedGenerationMethods?.includes('generateContent')
    );

    if (!validModel) {
      throw new Error("Tài khoản này không tìm thấy model nào khả dụng. Hãy tạo Key ở dự án khác.");
    }

    // Lấy tên chuẩn (Bỏ chữ 'models/' ở đầu nếu có)
    const modelName = validModel.name.replace('models/', '');
    console.log("Web đang sử dụng Model:", modelName);

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

    const data = await response.json();

    // Kiểm tra lỗi từ Google (Hết hạn mức, chặn...)
    if (data.error) {
      return `Lỗi từ Google: ${data.error.message}`;
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI không trả lời.";

  } catch (error) {
    console.error("Gemini Error:", error);
    return `Lỗi: ${error instanceof Error ? error.message : "Kết nối thất bại"}`;
  }
};