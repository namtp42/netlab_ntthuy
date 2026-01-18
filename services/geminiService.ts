/// <reference types="vite/client" />
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Device, Connection } from "../types";

// 1. Lấy API Key
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
// doi moi
// 2. Khởi tạo Instance (Thêm check null để tránh crash trang web nếu chưa load được key)
const genAI = new GoogleGenerativeAI(apiKey || "");

// 3. Chọn Model chuẩn: 'gemini-1.5-flash' (Nhanh, miễn phí và ổn định nhất hiện nay)
// Lưu ý: Không dùng 'gemini-3-flash' vì model này chưa public chính thức cho API key thường.
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const getNetworkAdvice = async (nodes: Device[], links: Connection[], userQuery: string) => {
  // Kiểm tra key trước khi gọi
  if (!apiKey) {
    console.error("Lỗi: Không tìm thấy VITE_GEMINI_API_KEY");
    return "Lỗi hệ thống: Chưa cấu hình API Key. Vui lòng kiểm tra file .env hoặc Vercel Settings.";
  }

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
    // 4. Gọi hàm generateContent chuẩn
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // 5. Lấy text ra (Lưu ý: text() là một hàm, phải có dấu ngoặc tròn)
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Xin lỗi, tôi gặp trục trặc khi phân tích mạng của bạn. Vui lòng thử lại sau.";
  }
};