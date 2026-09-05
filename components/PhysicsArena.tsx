"use client";

import React, { useState, useEffect, useRef } from "react";

// --- ĐỊNH NGHĨA KIỂU DỮ LIỆU CHUẨN ---
type Section = "MCQ" | "TF" | "SHORT" | "ESSAY";
type Difficulty = "NB" | "TH" | "VD" | "VDC";

interface Question {
  id: string;
  section: Section;
  subject: string;
  grade: string;
  topic: string;
  difficulty: Difficulty;
  content: string;
  imageUrl?: string;
  options?: { key: string; text: string }[];
  tf?: boolean[];
  shortAnswer?: string;
  tolerance?: number;
  points?: number;
}

const sectionLabel: Record<Section, string> = {
  MCQ: "Trắc nghiệm 4 lựa chọn",
  TF: "Đúng / Sai",
  SHORT: "Trả lời ngắn",
  ESSAY: "Tự luận & Vẽ hình"
};

// --- CÔNG CỤ BẢNG VẼ CHO HỌC SINH (DRAWING TOOL) ---
function DrawingPad({ onSave, initialData }: { onSave: (dataUrl: string) => void; initialData?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (initialData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initialData;
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) onSave(canvas.toDataURL());
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x = 0, y = 0;
    if ('clientX' in e) {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else if (e.touches && e.touches[0]) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onSave(canvas.toDataURL());
  };

  return (
    <div style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "8px", background: "#f8fafc", marginTop: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", alignItems: "center" }}>
        <span style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>🎨 Bảng vẽ hình / Sơ đồ bài làm:</span>
        <button type="button" onClick={clearCanvas} style={{ padding: "2px 8px", background: "#ef4444", color: "#fff", border: "none", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}>Xóa bảng vẽ</button>
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={200}
        style={{ background: "#fff", border: "1px solid #94a3b8", borderRadius: "4px", cursor: "crosshair", width: "100%", maxWidth: "100%" }}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseMove={draw}
        onTouchStart={startDrawing}
        onTouchEnd={stopDrawing}
        onTouchMove={draw}
      />
    </div>
  );
}

// --- BỘ CÔNG THỨC VÀ KÝ HIỆU KHOA HỌC NHANH (EQUATION TOOL) ---
const scientificSymbols: string[] = [
  "s = v·t", "v = s/t", "a = Δv/Δt", "F = m·a", "P = 10m", "A = F·s", "I = U/R", "Q = I²·R·t",
  "H₂O", "CO₂", "O₂", "HCl", "H₂SO₄", "NaOH", "NaCl", "CaCO₃", "→", "↑", "↓", "⇌",
  "²", "³", "√", "°C", "Δ", "α", "β", "λ", "μ", "Ω", "≤", "≥", "≠"
];

// --- GIAO DIỆN LÀM BÀI CỦA HỌC SINH ---
interface StudentViewProps {
  exam: Question[];
  answers: Record<string, any>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  current: number;
  setCurrent: React.Dispatch<React.SetStateAction<number>>;
  seconds: number;
  setSeconds: React.Dispatch<React.SetStateAction<number>>;
  studentName: string;
  setStudentName: React.Dispatch<React.SetStateAction<string>>;
  submitExam: () => void;
  submitted: boolean;
  autoScore: number;
}

function StudentView({
  exam,
  answers,
  setAnswers,
  current,
  setCurrent,
  seconds,
  setSeconds,
  studentName,
  setStudentName,
  submitExam,
  submitted,
  autoScore
}: StudentViewProps) {
  const q = exam[current];
  const [started, setStarted] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const submitExamRef = useRef(submitExam);
  useEffect(() => {
    submitExamRef.current = submitExam;
  }, [submitExam]);

  useEffect(() => {
    if (!started || submitted) return;

    const timer = setInterval(() => {
      setSeconds((prevSeconds: number) => {
        if (prevSeconds <= 1) {
          clearInterval(timer);
          submitExamRef.current();
          return 0;
        }
        return prevSeconds - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [started, submitted, setSeconds]);

  const insertSymbol = (symbol: string) => {
    const activeEl = document.getElementById("student-essay-textarea") as HTMLTextAreaElement;
    if (!activeEl) return;
    const start = activeEl.selectionStart;
    const end = activeEl.selectionEnd;
    const currentAnswerObj = typeof answers[q.id] === 'object' && answers[q.id] !== null ? answers[q.id] : { text: answers[q.id] || "" };
    const text = currentAnswerObj.text || "";
    const newText = text.substring(0, start) + symbol + text.substring(end);
    
    setAnswers((prev: Record<string, any>) => ({
      ...prev,
      [q.id]: {
        ...(prev[q.id] || {}),
        text: newText
      }
    }));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAnswers((prev: Record<string, any>) => ({
          ...prev,
          [q.id]: {
            ...(prev[q.id] || {}),
            audioBlob
          }
        }));
      };
      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      alert("Không thể truy cập microphone. Vui lòng cấp quyền micro trên trình duyệt!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  if (!started) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: "20px", textAlign: "center" }}>
      <h1 style={{ color: "#1e293b", marginBottom: "10px" }}>PHÒNG THI TRỰC TUYẾN KHTN</h1>
      <p style={{ color: "#64748b", marginBottom: "20px" }}>Nhập thông tin để bắt đầu làm bài kiểm tra.</p>
      <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0", width: "100%", maxWidth: "380px", textAlign: "left", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>Họ và tên học sinh:</label>
          <input type="text" placeholder="Nguyễn Văn A" value={studentName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentName(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px", marginTop: "4px" }} />
        </div>
        <button onClick={() => { if (!studentName.trim()) { alert("Vui lòng nhập tên!"); return; } setStarted(true); }} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>🚀 Bắt đầu làm bài</button>
      </div>
    </div>
  );

  if (!exam.length) return <div style={{ textAlign: "center", padding: "40px" }}>Đang tải đề thi mẫu...</div>;

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (submitted) {
    return (
      <div style={{ maxWidth: "700px", margin: "20px auto", background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
        <h2 style={{ textAlign: "center", color: "#1e293b" }}>🎉 ĐÃ NỘP BÀI THÀNH CÔNG!</h2>
        <p style={{ textAlign: "center", color: "#64748b" }}>Học sinh: <b>{studentName}</b></p>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "15px", borderRadius: "6px", textAlign: "center", marginTop: "15px" }}>
          Điểm trắc nghiệm tự động: <b style={{ color: "#16a34a", fontSize: "18px" }}>{autoScore.toFixed(2)}</b>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Phần tự luận, hình vẽ và ghi âm sẽ được giáo viên chấm điểm chi tiết.</div>
        </div>
      </div>
    );
  }

  const currentAnswerObj = typeof answers[q.id] === 'object' && answers[q.id] !== null ? answers[q.id] : { text: answers[q.id] || "" };

  return (
    <div style={{ maxWidth: "900px", margin: "20px auto", background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <div><b>{studentName}</b></div>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <div style={{ fontWeight: "bold", color: seconds < 60 ? "#dc2626" : "#0f172a" }}>⏱️ {mm}:{ss}</div>
          <button onClick={() => { if (confirm("Bạn có chắc chắn muốn nộp bài thi?")) submitExam(); }} style={{ background: "#16a34a", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", fontWeight: "600", cursor: "pointer" }}>Nộp bài</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr" }}>
        <div style={{ background: "#f8fafc", padding: "15px", borderRight: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", fontWeight: "bold", color: "#64748b", marginBottom: "10px" }}>CÂU HỎI</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
            {exam.map((x: Question, i: number) => (
              <button key={x.id} onClick={() => setCurrent(i)} style={{ padding: "8px", background: i === current ? "#2563eb" : (answers[x.id] !== undefined ? "#e0f2fe" : "#fff"), color: i === current ? "#fff" : "#0f172a", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>{i + 1}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>{sectionLabel[q.section]} · Câu {current + 1}</div>
          <h2 style={{ fontSize: "16px", color: "#1e293b", marginBottom: "15px" }}>{q.content}</h2>

          {q.imageUrl && (
            <div style={{ marginBottom: "15px" }}>
              <img src={q.imageUrl} alt="Minh họa" style={{ maxWidth: "100%", maxHeight: "250px", borderRadius: "6px" }} />
            </div>
          )}

          {q.section === "MCQ" && q.options?.map((o) => (
            <label key={o.key} style={{ display: "flex", gap: "10px", padding: "10px", border: "1px solid #e2e8f0", borderRadius: "6px", marginBottom: "8px", cursor: "pointer", background: answers[q.id] === o.key ? "#eff6ff" : "#fff" }}>
              <input type="radio" name={q.id} checked={answers[q.id] === o.key} onChange={() => setAnswers((a: Record<string, any>) => ({ ...a, [q.id]: o.key }))} />
              <span><b>{o.key}.</b> {o.text}</span>
            </label>
          ))}

          {q.section === "SHORT" && (
            <div>
              <input type="text" placeholder="Nhập câu trả lời ngắn..." value={answers[q.id] ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnswers((a: Record<string, any>) => ({ ...a, [q.id]: e.target.value }))} style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", marginBottom: "10px" }} />
              <DrawingPad 
                initialData={currentAnswerObj.drawingData}
                onSave={(dataUrl: string) => {
                  setAnswers((prev: Record<string, any>) => ({
                    ...prev,
                    [q.id]: {
                      ...(typeof prev[q.id] === 'object' && prev[q.id] !== null ? prev[q.id] : { text: prev[q.id] || "" }),
                      drawingData: dataUrl
                    }
                  }));
                }}
              />
            </div>
          )}

          {q.section === "ESSAY" && (
            <div>
              {/* Bảng công thức nhanh */}
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px", background: "#f1f5f9", padding: "6px", borderRadius: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", alignSelf: "center", marginRight: "5px" }}>Công thức nhanh:</span>
                {scientificSymbols.map((sym: string) => (
                  <button key={sym} type="button" onClick={() => insertSymbol(sym)} style={{ padding: "4px 6px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontFamily: "monospace" }}>{sym}</button>
                ))}
              </div>

              <textarea 
                id="student-essay-textarea"
                rows={4}
                placeholder="Nhập bài làm tự luận chi tiết..."
                value={currentAnswerObj.text || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  const val = e.target.value;
                  setAnswers((prev: Record<string, any>) => ({
                    ...prev,
                    [q.id]: {
                      ...(prev[q.id] || {}),
                      text: val
                    }
                  }));
                }}
                style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", fontFamily: "inherit" }}
              />

              {/* Tích hợp bảng vẽ canvas */}
              <DrawingPad 
                initialData={currentAnswerObj.drawingData}
                onSave={(dataUrl: string) => {
                  setAnswers((prev: Record<string, any>) => ({
                    ...prev,
                    [q.id]: {
                      ...(prev[q.id] || {}),
                      drawingData: dataUrl
                    }
                  }));
                }}
              />

              <div style={{ marginTop: "12px", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "10px" }}>
                {!recording ? (
                  <button type="button" onClick={startRecording} style={{ background: "#dc2626", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>🔴 Ghi âm giải thích</button>
                ) : (
                  <button type="button" onClick={stopRecording} style={{ background: "#475569", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>⏹️ Dừng ghi âm</button>
                )}
                {currentAnswerObj.audioBlob && <span style={{ color: "#16a34a", fontSize: "13px", fontWeight: "600" }}>✓ Đã lưu file ghi âm</span>}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
            <button disabled={current === 0} onClick={() => setCurrent((c: number) => Math.max(0, c - 1))} style={{ padding: "6px 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer" }}>⬅️ Câu trước</button>
            <button disabled={current === exam.length - 1} onClick={() => setCurrent((c: number) => Math.min(exam.length - 1, c + 1))} style={{ padding: "6px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>Câu tiếp theo ➡</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENT CHÍNH ---
export default function PhysicsArena() {
  const [mode, setMode] = useState<"teacher" | "student">("teacher");
  
  // Dữ liệu mẫu kiểm tra
  const [exam, setExam] = useState<Question[]>([
    {
      id: "q1",
      section: "MCQ",
      subject: "Khoa học tự nhiên",
      grade: "6",
      topic: "Lực và Chuyển động",
      difficulty: "NB",
      content: "Đơn vị đo lực trong hệ SI là gì?",
      options: [
        { key: "A", text: "Kilôgam (kg)" },
        { key: "B", text: "Niu-tơn (N)" },
        { key: "C", text: "Mét trên giây (m/s)" },
        { key: "D", text: "Giôn (J)" }
      ],
      shortAnswer: "B",
      points: 1
    },
    {
      id: "q2",
      section: "ESSAY",
      subject: "Khoa học tự nhiên",
      grade: "6",
      topic: "Áp suất chất lỏng",
      difficulty: "VD",
      content: "Em hãy vẽ sơ đồ lực tác dụng và giải thích vì sao vật chìm hay nổi trong nước.",
      points: 2
    }
  ]);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [current, setCurrent] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(1800);
  const [studentName, setStudentName] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [autoScore, setAutoScore] = useState<number>(0);

  const submitExam = () => {
    let score = 0;
    exam.forEach((q: Question) => {
      const ans = answers[q.id];
      if (q.section === "MCQ" && ans === q.shortAnswer) {
        score += (q.points || 1);
      }
    });
    setAutoScore(score);
    setSubmitted(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "sans-serif" }}>
      <header style={{ background: "#1e293b", color: "#fff", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "18px" }}>⚡ ĐẤU TRƯỜNG KHTN - THẦY TUẤN</h2>
        <div>
          <button onClick={() => setMode("teacher")} style={{ padding: "6px 12px", background: mode === "teacher" ? "#2563eb" : "#475569", color: "#fff", border: "none", borderRadius: "4px", marginRight: "8px", cursor: "pointer" }}>Giáo viên</button>
          <button onClick={() => setMode("student")} style={{ padding: "6px 12px", background: mode === "student" ? "#2563eb" : "#475569", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>Học sinh</button>
        </div>
      </header>

      <main style={{ padding: "20px" }}>
        {mode === "teacher" ? (
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", maxWidth: "800px", margin: "0 auto" }}>
            <h3>Khu vực Quản lý Đề thi & Soạn câu hỏi</h3>
            <p style={{ color: "#64748b" }}>Thầy có thể cấu hình đề kiểm tra, import danh sách câu hỏi hoặc xem trước giao diện thi của học sinh bằng cách bấm sang tab "Học sinh" phía trên.</p>
          </div>
        ) : (
          <StudentView 
            exam={exam}
            answers={answers}
            setAnswers={setAnswers}
            current={current}
            setCurrent={setCurrent}
            seconds={seconds}
            setSeconds={setSeconds}
            studentName={studentName}
            setStudentName={setStudentName}
            submitExam={submitExam}
            submitted={submitted}
            autoScore={autoScore}
          />
        )}
      </main>
    </div>
  );
}
