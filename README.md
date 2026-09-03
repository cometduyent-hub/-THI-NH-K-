# ⚡ Physics Test Arena

Web app kiểm tra online môn Vật lí theo quy trình:

**NGÂN HÀNG CÂU HỎI → MA TRẬN/TẠO ĐỀ → THI ONLINE → CHẤM → THỐNG KÊ**

## Tính năng V1

- Giao diện giáo viên và học sinh.
- 4 phần: nhiều lựa chọn, Đúng/Sai, trả lời ngắn, tự luận.
- Thanh câu hỏi để học sinh nhảy nhanh tới câu bất kỳ.
- Đánh dấu câu đã trả lời / chưa trả lời.
- Cho phép quay lại sửa bài trước khi nộp.
- Đồng hồ đếm ngược.
- Tạo đề theo ma trận có thể chỉnh số câu theo phần và mức độ.
- Xáo câu hỏi và xáo đáp án.
- Import ngân hàng câu hỏi từ `.xlsx`, `.csv`, `.json`.
- Import hình ảnh trong câu hỏi từ file máy.
- Chấm Đúng/Sai theo quy tắc:
  - 0 ý sai → 1,00
  - 1 ý sai → 0,50
  - 2 ý sai → 0,25
  - 3 ý sai → 0,10
  - 4 ý sai → 0,00
- Màn hình chấm tự luận thủ công.
- Thống kê cơ bản.
- Có sẵn schema Supabase để triển khai dữ liệu thật.

## Chạy trên máy

Yêu cầu Node.js 20+.

```bash
npm install
npm run dev
```

Mở http://localhost:3000

## Deploy GitHub → Vercel

1. Tạo repository GitHub mới.
2. Upload toàn bộ mã nguồn trong ZIP.
3. Import repository vào Vercel.
4. Framework: Next.js (Vercel thường tự nhận).
5. Thêm biến môi trường từ `.env.example` nếu kết nối Supabase.
6. Deploy.

## Supabase

Chạy nội dung `supabase/schema.sql` trong SQL Editor của Supabase.
Sau đó điền:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Định dạng Excel mẫu

Xem `data/question-bank-template.csv` và `data/question-bank-template.json`.

Các trường quan trọng:

- `id`
- `section` = MCQ | TF | SHORT | ESSAY
- `subject`
- `grade`
- `topic`
- `difficulty` = NB | TH | VD | VDC
- `content`
- `optionA`, `optionB`, `optionC`, `optionD`
- `correctOption` = A/B/C/D
- `tfA`, `tfB`, `tfC`, `tfD` = true/false
- `shortAnswer`
- `tolerance`
- `points`
- `imageUrl`

Lưu ý: bản V1 lưu demo trong trình duyệt để có thể thử ngay. Khi kết nối Supabase, có thể chuyển sang dữ liệu dùng chung cho nhiều giáo viên/lớp.
