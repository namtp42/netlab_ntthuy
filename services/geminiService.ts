/// <reference types="vite/client" />
import { Device, Connection } from "../types";
//1
//2
// Key của bạn (Giữ nguyên, key này đang sống tốt)
const API_KEY = "AIzaSyAVHoyfjlXamUt8Wf_IUvsI6_0Ks4VWGaAc";
//<<<<<<< HEAD

//=======

//>>>>>>> 360435c348aa142adb14930e44ee43f75b5a712d
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
    // BƯỚC 1: HỎI GOOGLE XEM KEY NÀY DÙNG ĐƯỢC MODEL NÀO?
    // (Tránh lỗi 404 do sai tên model)
    const listModelResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    
    if (!listModelResponse.ok) {
        const err = await listModelResponse.json();
        throw new Error(err.error?.message || "Lỗi khi kiểm tra Key");
    }

    const listModelData = await listModelResponse.json();
    
    // Tìm model tốt nhất: Ưu tiên Flash -> Sau đó đến Pro -> Cuối cùng là bất kỳ cái nào chạy được
    const validModel = listModelData.models?.find((m: any) => 
      m.name.includes('flash') && m.supportedGenerationMethods?.includes('generateContent')
    ) || listModelData.models?.find((m: any) => 
      m.name.includes('pro') && !m.name.includes('vision') && m.supportedGenerationMethods?.includes('generateContent')
    );

    if (!validModel) {
        return "Lỗi: Key này không tìm thấy model phù hợp.";
    }

    // Lấy tên chính xác (Ví dụ: models/gemini-1.5-flash-001)
    // Lưu ý: API trả về có sẵn chữ 'models/', ta giữ nguyên hoặc cắt tùy endpoint.
    // Với endpoint gọi hàm, ta cần cắt bỏ 'models/' nếu dùng URL ngắn, nhưng dùng URL full thì để nguyên cũng được.
    // Ở đây ta cắt đi cho chuẩn format URL.
    const exactModelName = validModel.name.replace('models/', '');
    console.log("Đang dùng model:", exactModelName);

    // BƯỚC 2: GỌI CHÍNH XÁC MODEL ĐÓ
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${exactModelName}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          // Cấu hình để không bị chặn khi hỏi về mạng/hack/security
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

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI không phản hồi.";

  } catch (error) {
    console.error("Lỗi:", error);
    return `Lỗi hệ thống: ${error instanceof Error ? error.message : "Mất kết nối"}`;
  }
};
