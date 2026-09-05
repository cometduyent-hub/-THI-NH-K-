"use client";

import { ChangeEvent, useEffect, useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type Section = "MCQ" | "TF" | "SHORT" | "ESSAY";
type Difficulty = "NB" | "TH" | "VD" | "VDC";

type Question = {
  id: string;
  section: Section;
  subject: string;
  grade: string;
  topic: string;
  difficulty: Difficulty;
  content: string;
  videoUrl?: string;
  audioUrl?: string;
  options?: { key: string; text: string }[];
  correctOption?: string;
  tf?: boolean[];
  tfOptions?: { key: string; text: string }[];
  shortAnswer?: string;
  tolerance?: number;
  points: number;
};

type Matrix = {
  MCQ: { NB: number; TH: number; VD: number; VDC: number };
  TF: { NB: number; TH: number; VD: number; VDC: number };
  SHORT: { NB: number; TH: number; VD: number; VDC: number };
  ESSAY: { NB: number; TH: number; VD: number; VDC: number };
};

const seed: Question[] = [
  { id:"KHTN001", section:"MCQ", subject:"Khoa học tự nhiên", grade:"7", topic:"Tốc độ chuyển động", difficulty:"NB", content:"Đại lượng cho biết mức độ nhanh hay chậm của chuyển động là:", options:[{key:"A",text:"Khối lượng"},{key:"B",text:"Vận tốc"},{key:"C",text:"Lực"},{key:"D",text:"Áp suất"}], correctOption:"B", points:.25 },
  { id:"KHTN002", section:"TF", subject:"Khoa học tự nhiên", grade:"7", topic:"Ánh sáng", difficulty:"TH", content:"Các nhận định về hiện tượng phản xạ ánh sáng:", tf:[true,false,true,false], points:1 },
  { id:"KHTN003", section:"SHORT", subject:"Khoa học tự nhiên", grade:"7", topic:"Âm thanh", difficulty:"VD", content:"Một nguồn âm dao động thực hiện 600 dao động trong 20 giây. Tần số dao động của nguồn âm là (Hz):", shortAnswer:"30", tolerance:.1, points:.5 },
  { id:"KHTN004", section:"ESSAY", subject:"Khoa học tự nhiên", grade:"7", topic:"Trao đổi chất", difficulty:"VD", content:"Giải thích vai trò của quá trình quang hợp đối với sự sống trên Trái Đất?", points:2 }
];

const defaultMatrix: Matrix = {
  MCQ: { NB:1, TH:1, VD:0, VDC:0 },
  TF: { NB:0, TH:1, VD:0, VDC:0 },
  SHORT: { NB:0, TH:1, VD:0, VDC:0 },
  ESSAY: { NB:0, TH:0, VD:1, VDC:0 }
};

const sectionLabel: Record<Section,string> = { MCQ:"I. Nhiều lựa chọn", TF:"II. Đúng / Sai", SHORT:"III. Trả lời ngắn", ESSAY:"IV. Tự luận" };
const diffLabel: Record<Difficulty,string> = { NB:"Nhận biết", TH:"Thông hiểu", VD:"Vận dụng", VDC:"Vận dụng cao" };

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleExamSections(questionList: Question[]) {
  const mcq = questionList.filter(q => q.section === "MCQ");
  const tf = questionList.filter(q => q.section === "TF");
  const short = questionList.filter(q => q.section === "SHORT");
  const essay = questionList.filter(q => q.section === "ESSAY");

  const shuffleArray = (arr: any[]) => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  return [
    ...shuffleArray(mcq).map(q => q.options ? {...q, options: shuffleArray(q.options)} : q),
    ...shuffleArray(tf),
    ...shuffleArray(short),
    ...shuffleArray(essay)
  ];
}

function scoreTF(answer: boolean[] | undefined, key: boolean[] | undefined, point: number) {
  if (!answer || !key) return 0;
  const wrong = answer.reduce((n, v, i) => n + (v !== key[i] ? 1 : 0), 0);
  const factor = [1, .5, .25, .1, 0][wrong];
  return point * factor;
}

function parseRow(r: any): Question {
  const section = String(r.section || "MCQ").toUpperCase() as Section;
  const options = ["A", "B", "C", "D"].map(k => ({ key: k, text: String(r[`option${k}`] ?? r[`option_${k.toLowerCase()}`] ?? "") })).filter(x => x.text);
  const tf = ["tfA", "tfB", "tfC", "tfD"].map(k => String(r[k]).toLowerCase() === "true" || r[k] === true || r[k] === 1 || r[k] === "1");
  return {
    id: String(r.id || crypto.randomUUID()),
    section: section,
    subject: String(r.subject || "Khoa học tự nhiên"),
    grade: String(r.grade || "7"),
    topic: String(r.topic || "Chưa phân loại"),
    difficulty: (String(r.difficulty || "TH").toUpperCase() as Difficulty),
    content: String(r.content || ""),
    videoUrl: String(r.videoUrl || "") || undefined,
    audioUrl: String(r.audioUrl || "") || undefined,
    options: options.length ? options : undefined,
    correctOption: String(r.correctOption || ""),
    tf: section === "TF" ? tf : undefined,
    tfOptions: section === "TF" ? options : undefined,
    shortAnswer: String(r.shortAnswer ?? "") || undefined,
    tolerance: Number(r.tolerance || 0),
    points: Number(r.points || 1)
  };
}

export default function PhysicsArena() {
  const [mode, setMode] = useState<"teacher" | "student">("teacher");
  const [tab, setTab] = useState<"bank" | "matrix" | "exam" | "grading" | "stats">("bank");
  const [questions, setQuestions] = useState<Question[]>(seed);
  const [matrix, setMatrix] = useState<Matrix>(defaultMatrix);
  const [exam, setExam] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [minutes, setMinutes] = useState(45);
  const [seconds, setSeconds] = useState(45 * 60);
  const [essayScores, setEssayScores] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const examId = params.get("exam");
    if (examId) {
      setMode("student");
      async function fetchExamFromCloud() {
        const { data, error } = await supabase.from('exams').select('questions_data').eq('id', examId).single();
        if (data && data.questions_data) {
          setExam(data.questions_data);
          setNotice(`Đã tải thành công đề thi (${examId}) cho học sinh.`);
        } else {
          alert("Không tìm thấy mã đề thi này hoặc link không hợp lệ!");
        }
      }
      fetchExamFromCloud();
    }
  }, []);

  const autoScore = useMemo(() => exam.reduce((s, q) => {
    const a = answers[q.id];
    if (q.section === "MCQ") return s + (a === q.correctOption ? q.points : 0);
    if (q.section === "TF") return s + scoreTF(a, q.tf, q.points);
    if (q.section === "SHORT") {
      const n = Number(a); 
      const key = Number(q.shortAnswer);
      return s + (Number.isFinite(n) && Math.abs(n - key) <= Number(q.tolerance || 0) ? q.points : 0);
    }
    return s;
  }, 0), [exam, answers]);
  
  const essayTotalScore = Object.values(essayScores).reduce((a, b) => a + b, 0);
  const finalScore = autoScore + essayTotalScore;

  function generateExam() {
    const selected: Question[] = [];
    (Object.keys(matrix) as Section[]).forEach(sec => {
      (Object.keys(matrix[sec]) as Difficulty[]).forEach(d => {
        const n = matrix[sec][d];
        const pool = questions.filter(q => q.section === sec && q.difficulty === d);
        selected.push(...shuffle(pool).slice(0, n));
      });
    });
    const randomized = shuffleExamSections(selected);
    setExam(randomized);
    setAnswers({});
    setEssayScores({});
    setCurrent(0);
    setSubmitted(false);
    setSeconds(minutes * 60);
    setTab("exam");
    setNotice(`Đã tạo đề ${randomized.length} câu từ ngân hàng.`);
  }

  async function handlePublishAndGetLink() {
    if (exam.length === 0) {
      alert("Chưa có đề thi nào được tạo! Thầy hãy bấm 'Tạo đề thi' trước.");
      return;
    }
    const examCode = "KHTN_" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('exams').insert([{ id: examCode, title: "Kiểm tra Khoa học tự nhiên", questions_data: exam }]);
    if (error) {
      alert("Lỗi khi lưu đề lên hệ thống: " + error.message);
    } else {
      const shareLink = `${window.location.origin}/?exam=${examCode}`;
      prompt("Đã xuất link thành công! Thầy hãy copy đường link sau gửi cho học sinh:", shareLink);
    }
  }

  function updateMatrix(sec: Section, d: Difficulty, value: number) {
    setMatrix(m => ({ ...m, [sec]: { ...m[sec], [d]: Math.max(0, Math.floor(value || 0)) } }));
  }

  function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        let rows: any[] = [];
        if (file.name.endsWith(".json")) rows = JSON.parse(String(data));
        else {
          const wb = XLSX.read(data, { type: "array" });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        }
        const parsed = rows.map(parseRow).filter(q => q.content);
        setQuestions(parsed);
        setNotice(`Đã cập nhật ${parsed.length} câu hỏi từ ${file.name}.`);
      } catch (err) { setNotice("Không đọc được file. Hãy kiểm tra định dạng mẫu."); }
    };
    if (file.name.endsWith(".json")) reader.readAsText(file); else reader.readAsArrayBuffer(file);
  }

  function submitExam() {
    setSubmitted(true);
    setTab("grading");
    setNotice("Bài đã được nộp. Các phần tự động đã được chấm.");
  }

  return (
    <main className="app-shell" style={{ 
      fontFamily: "Inter, system-ui, Arial, sans-serif", 
      background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)", 
      minHeight: "100vh", 
      paddingBottom: "40px",
      color: "#1e293b"
    }}>
      <header className="topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(10px)", borderBottom: "1px solid #d1fae5", boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.05)" }}>
        <div className="brand" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="atom" style={{ fontSize: "28px", background: "#dcfce7", padding: "6px 10px", borderRadius: "12px", border: "1px solid #86efac" }}>🧬</span>
          <div><b style={{ fontSize: "18px", color: "#065f46", letterSpacing: "0.5px" }}>ĐẤU TRƯỜNG KHOA HỌC TỰ NHIÊN</b><div style={{ fontSize: "12px", color: "#047857", fontWeight: "500" }}>Hệ thống quản lý ôn tập & kiểm tra trực tuyến</div></div>
        </div>
        <div className="top-actions" style={{ display: "flex", gap: "10px" }}>
          {mode === "teacher" ? (
            <button onClick={() => setMode("student")} style={{ padding: "8px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", cursor: "pointer", fontWeight: "600", color: "#047857" }}>🔓 Thoát quyền GV</button>
          ) : (
            <button onClick={() => {
              const pass = prompt("Nhập mật khẩu giáo viên:");
              if (pass === "123456") setMode("teacher");
              else if (pass !== null) alert("Sai mật khẩu!");
            }} style={{ padding: "8px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", cursor: "pointer", fontWeight: "600", color: "#047857" }}>🔒 Giáo viên</button>
          )}
          <button className={mode === "student" ? "active" : ""} onClick={() => setMode("student")} style={{ padding: "8px 14px", background: mode === "student" ? "#059669" : "#f0fdf4", color: mode === "student" ? "#fff" : "#047857", border: "1px solid #86efac", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>👨‍🎓 Học sinh</button>
        </div>
      </header>

      {notice && <div className="notice" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "12px 24px", margin: "20px 28px", borderRadius: "10px", color: "#065f46", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}><span>{notice}</span><button onClick={() => setNotice("")} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "16px", color: "#047857" }}>×</button></div>}

      {mode === "teacher" ? (
        <section className="workspace" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "24px", padding: "0 28px", marginTop: "24px" }}>
          <aside className="sidebar" style={{ background: "rgba(255, 255, 255, 0.95)", padding: "18px", borderRadius: "14px", border: "1px solid #a7f3d0", height: "fit-content", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)" }}>
            <div className="side-title" style={{ fontSize: "11px", fontWeight: "700", color: "#059669", marginBottom: "12px", letterSpacing: "1px" }}>BẢNG ĐIỀU KHIỂN KHTN</div>
            {[
              ["bank", "📚", "Ngân hàng câu hỏi"],
              ["matrix", "🧩", "Ma trận & tạo đề"],
              ["exam", "📝", "Xem & Sửa đề"],
              ["grading", "✍️", "Chấm bài tự luận"],
              ["stats", "📊", "Thống kê phổ điểm"]
            ].map(([id, icon, label]) => (
              <button key={id} className={tab === id ? "nav active" : "nav"} onClick={() => setTab(id as any)} style={{ width: "100%", textAlign: "left", padding: "12px 14px", background: tab === id ? "#d1fae5" : "transparent", color: tab === id ? "#065f46" : "#334155", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: tab === id ? "700" : "500", display: "flex", gap: "10px", marginBottom: "6px", transition: "all 0.2s" }}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </aside>

          <div className="content" style={{ background: "rgba(255, 255, 255, 0.95)", padding: "24px", borderRadius: "14px", border: "1px solid #a7f3d0", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)" }}>
            {tab === "bank" && (
              <div>
                <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div><h1 style={{ fontSize: "22px", margin: 0, color: "#065f46" }}>Ngân hàng câu hỏi KHTN</h1><p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>Quản lý chung câu hỏi Vật lí, Hóa học, Sinh học và tích hợp media.</p></div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <label className="primary-btn" style={{ background: "#059669", color: "#fff", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "6px" }}>📥 Nhập file Excel/JSON
                      <input hidden type="file" accept=".xlsx,.csv,.json" onChange={importFile} />
                    </label>
                    <button style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "13px" }} onClick={() => {
                      const newQ: Question = {
                        id: "KHTN_" + Date.now(),
                        section: "MCQ",
                        subject: "Khoa học tự nhiên",
                        grade: "7",
                        topic: "Chủ đề mới",
                        difficulty: "TH",
                        content: "Nội dung câu hỏi mới...",
                        options: [{ key: "A", text: "Đáp án A" }, { key: "B", text: "Đáp án B" }, { key: "C", text: "Đáp án C" }, { key: "D", text: "Đáp án D" }],
                        correctOption: "A",
                        points: 0.25
                      };
                      setQuestions(prev => [newQ, ...prev]);
                    }}>➕ Thêm câu mới</button>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#ecfdf5", textAlign: "left", color: "#065f46" }}>
                        <th style={{ padding: "10px", border: "1px solid #a7f3d0" }}>ID</th>
                        <th style={{ padding: "10px", border: "1px solid #a7f3d0" }}>Phần</th>
                        <th style={{ padding: "10px", border: "1px solid #a7f3d0" }}>Nội dung</th>
                        <th style={{ padding: "10px", border: "1px solid #a7f3d0" }}>Media đính kèm</th>
                        <th style={{ padding: "10px", border: "1px solid #a7f3d0" }}>Xóa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q, index) => (
                        <tr key={q.id || index}>
                          <td style={{ padding: "10px", border: "1px solid #cbd5e1" }}><b>{q.id}</b></td>
                          <td style={{ padding: "10px", border: "1px solid #cbd5e1" }}>{sectionLabel[q.section]}</td>
                          <td style={{ padding: "10px", border: "1px solid #cbd5e1" }}>{q.content}</td>
                          <td style={{ padding: "10px", border: "1px solid #cbd5e1" }}>
                            {q.videoUrl && <span style={{ color: "#2563eb", marginRight: "8px" }}>🎥 Có video</span>}
                            {q.audioUrl && <span style={{ color: "#16a34a" }}>🔊 Có âm thanh</span>}
                            {!q.videoUrl && !q.audioUrl && <span style={{ color: "#94a3b8" }}>Không có</span>}
                          </td>
                          <td style={{ padding: "10px", border: "1px solid #cbd5e1" }}>
                            <button style={{ background: "#fee2e2", color: "#991b1b", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer" }} onClick={() => { if (confirm("Xóa câu này?")) setQuestions(prev => prev.filter((_, i) => i !== index)); }}>🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "matrix" && (
              <div>
                <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
                  <div><h1 style={{ fontSize: "22px", margin: 0, color: "#065f46" }}>Ma trận & tạo đề</h1><p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>Chọn số lượng câu và xuất link giao bài cho học sinh.</p></div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={generateExam} style={{ background: "#059669", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Tạo đề thi</button>
                    <button onClick={handlePublishAndGetLink} style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>🔗 Xuất link gửi học sinh</button>
                  </div>
                </div>
                {(Object.keys(matrix) as Section[]).map(sec => (
                  <div key={sec} style={{ display: "grid", gridTemplateColumns: "220px repeat(4, 1fr)", gap: "12px", alignItems: "center", marginBottom: "12px", background: "#f0fdf4", padding: "12px", borderRadius: "8px", border: "1px solid #d1fae5" }}>
                    <strong style={{ color: "#065f46" }}>{sectionLabel[sec]}</strong>
                    {(["NB", "TH", "VD", "VDC"] as Difficulty[]).map(d => (
                      <div key={d} style={{ display: "flex", flexDirection: "column" }}>
                        <label style={{ fontSize: "11px", color: "#047857", fontWeight: "600" }}>{diffLabel[d]}</label>
                        <input type="number" min="0" value={matrix[sec][d]} onChange={e => updateMatrix(sec, d, Number(e.target.value))} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #a7f3d0", background: "#fff" }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {tab === "exam" && (
              <div>
                <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div><h1 style={{ fontSize: "22px", margin: 0, color: "#065f46" }}>Xem & Chỉnh sửa đề thi hiện tại</h1><p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>Thầy có thể sửa trực tiếp nội dung câu hỏi, link media hoặc đáp án nếu chưa phù hợp.</p></div>
                  <button onClick={generateExam} style={{ background: "#f0fdf4", border: "1px solid #a7f3d0", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", color: "#065f46" }}>🔄 Tạo đề mới</button>
                </div>
                {exam.length === 0 ? <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>Chưa có đề. Vui lòng vào Ma trận & tạo đề.</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                    {exam.map((q, i) => (
                      <div key={q.id} style={{ border: "1px solid #a7f3d0", padding: "16px", borderRadius: "10px", background: "#fdfefe" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontWeight: "700", color: "#059669" }}>Câu {i + 1} ({q.section})</span>
                          <span style={{ fontSize: "12px", background: "#ecfdf5", color: "#065f46", padding: "2px 8px", borderRadius: "4px", border: "1px solid #a7f3d0" }}>Điểm: {q.points}</span>
                        </div>
                        <input 
                          type="text" 
                          value={q.content} 
                          onChange={e => {
                            const val = e.target.value;
                            setExam(prev => prev.map((item, idx) => idx === i ? { ...item, content: val } : item));
                          }}
                          style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", marginBottom: "10px", fontWeight: "600" }} 
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "8px" }}>
                          <div>
                            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>Link Video (YouTube/MP4):</label>
                            <input 
                              type="text" 
                              placeholder="https://..." 
                              value={q.videoUrl || ""} 
                              onChange={e => {
                                const val = e.target.value;
                                setExam(prev => prev.map((item, idx) => idx === i ? { ...item, videoUrl: val } : item));
                              }}
                              style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }} 
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>Link Âm thanh (MP3):</label>
                            <input 
                              type="text" 
                              placeholder="https://..." 
                              value={q.audioUrl || ""} 
                              onChange={e => {
                                const val = e.target.value;
                                setExam(prev => prev.map((item, idx) => idx === i ? { ...item, audioUrl: val } : item));
                              }}
                              style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }} 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "grading" && (
              <div>
                <h1 style={{ fontSize: "22px", marginBottom: "5px", color: "#065f46" }}>Chấm bài học sinh</h1>
                <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "20px" }}>Tổng điểm tự động + Chấm tự luận thủ công.</p>
                <div style={{ display: "flex", gap: "20px", background: "#f0fdf4", padding: "16px", borderRadius: "10px", border: "1px solid #a7f3d0", marginBottom: "20px" }}>
                  <div>Trắc nghiệm: <b style={{ color: "#059669" }}>{autoScore.toFixed(2)}</b></div>
                  <div>Tự luận: <b style={{ color: "#059669" }}>{essayTotalScore.toFixed(2)}</b></div>
                  <div>Tổng điểm: <b style={{ color: "#047857", fontSize: "16px" }}>{finalScore.toFixed(2)}</b></div>
                </div>
                {exam.filter(q => q.section === "ESSAY").map(q => (
                  <div key={q.id} style={{ border: "1px solid #a7f3d0", padding: "16px", borderRadius: "10px", marginBottom: "15px", background: "#fff" }}>
                    <p style={{ fontWeight: "bold", color: "#1e293b" }}>{q.content}</p>
                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "12px", border: "1px solid #e2e8f0" }}>
                      <b>Bài làm văn bản:</b> {typeof answers[q.id] === 'object' ? answers[q.id]?.text : (answers[q.id] || "Chưa làm")}
                      {answers[q.id]?.audioBlob && (
                        <div style={{ marginTop: "10px" }}>
                          <b>File ghi âm của học sinh:</b><br />
                          <audio controls src={URL.createObjectURL(answers[q.id].audioBlob)} style={{ marginTop: "6px" }} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <label style={{ fontSize: "13px", fontWeight: "600" }}>Cho điểm:</label>
                      <input 
                        type="number" 
                        min="0" 
                        max={q.points || 1} 
                        step="0.25" 
                        value={essayScores[q.id] ?? ""} 
                        onChange={e => setEssayScores(prev => ({ ...prev, [q.id]: parseFloat(e.target.value) || 0 }))}
                        style={{ width: "90px", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "stats" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div><h1 style={{ fontSize: "22px", margin: 0, color: "#065f46" }}>Thống kê phổ điểm</h1><p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>Phân tích kết quả kiểm tra KHTN.</p></div>
                  <button onClick={() => window.print()} style={{ background: "#0284c7", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>📥 Xuất báo cáo PDF</button>
                </div>
                <div style={{ background: "#f0fdf4", padding: "24px", borderRadius: "10px", border: "1px solid #a7f3d0", textAlign: "center" }}>
                  <h3 style={{ color: "#065f46", fontSize: "20px" }}>Điểm tổng kết học sinh: {finalScore.toFixed(2)} điểm</h3>
                  <p style={{ color: "#047857" }}>Hệ thống đã ghi nhận đầy đủ kết quả trắc nghiệm và tự luận.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <StudentView exam={exam} answers={answers} setAnswers={setAnswers} current={current} setCurrent={setCurrent} seconds={seconds} setSeconds={setSeconds} studentName={studentName} setStudentName={setStudentName} submitExam={submitExam} submitted={submitted} autoScore={autoScore} essayScores={essayScores} />
      )}

      <footer style={{ textAlign: "center", marginTop: "40px", fontSize: "12px", color: "#047857", fontWeight: "500" }}>⚡ Đấu Trường Khoa học Tự nhiên · Giao diện sáng tạo chuyên biệt KHTN</footer>
    </main>
  );
}

function StudentView({ exam, answers, setAnswers, current, setCurrent, seconds, setSeconds, studentName, setStudentName, submitExam, submitted, autoScore }: any) {
  const q = exam[current];
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useMemo(() => { 
    if (!started || submitted) return; 
    const t = setInterval(() => setSeconds((s: number) => Math.max(0, s - 1)), 1000); 
    return () => clearInterval(t); 
  }, [started, submitted, setSeconds]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAnswers((prev: any) => ({
          ...prev,
          [q.id]: typeof prev[q.id] === 'object' && prev[q.id] !== null 
            ? { ...prev[q.id], audioBlob } 
            : { text: prev[q.id] || "", audioBlob }
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
      <h1 style={{ color: "#065f46", marginBottom: "8px" }}>PHÒNG THI TRỰC TUYẾN KHTN</h1>
      <p style={{ color: "#64748b", marginBottom: "20px", fontSize: "14px" }}>Nhập thông tin để bắt đầu làm bài kiểm tra Khoa học tự nhiên.</p>
      <div style={{ background: "rgba(255, 255, 255, 0.95)", padding: "24px", borderRadius: "12px", border: "1px solid #a7f3d0", width: "100%", maxWidth: "380px", textAlign: "left", display: "flex", flexDirection: "column", gap: "14px", boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.05)" }}>
        <div>
          <label style={{ fontSize: "12px", fontWeight: "700", color: "#065f46" }}>Họ và tên học sinh:</label>
          <input type="text" placeholder="Nguyễn Văn A" value={studentName} onChange={e => setStudentName(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "6px", outline: "none" }} />
        </div>
        <button onClick={() => { if (!studentName.trim()) { alert("Vui lòng nhập tên!"); return; } setStarted(true); }} style={{ width: "100%", padding: "12px", background: "#059669", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(5, 150, 105, 0.2)" }}>🚀 Bắt đầu làm bài</button>
      </div>
    </div>
  );

  if (!exam.length) return <div style={{ textAlign: "center", padding: "40px" }}>Đang tải đề thi...</div>;

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (submitted) {
    return (
      <div style={{ maxWidth: "700px", margin: "40px auto", background: "#fff", padding: "30px", borderRadius: "12px", border: "1px solid #a7f3d0", textAlign: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
        <h2 style={{ color: "#065f46" }}>🎉 ĐÃ NỘP BÀI THÀNH CÔNG!</h2>
        <p style={{ color: "#334155" }}>Học sinh: <b>{studentName}</b></p>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "20px", borderRadius: "8px", marginTop: "20px" }}>
          Điểm trắc nghiệm tự động: <b style={{ color: "#059669", fontSize: "20px" }}>{autoScore.toFixed(2)} điểm</b>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "950px", margin: "20px auto", background: "#fff", borderRadius: "12px", border: "1px solid #a7f3d0", overflow: "hidden", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", background: "#f0fdf4", borderBottom: "1px solid #d1fae5" }}>
        <div>Học sinh: <b style={{ color: "#065f46" }}>{studentName}</b></div>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <div style={{ fontWeight: "700", color: seconds < 60 ? "#dc2626" : "#065f46", background: "#fff", padding: "6px 12px", borderRadius: "6px", border: "1px solid #a7f3d0" }}>⏱️ {mm}:{ss}</div>
          <button onClick={() => { if (confirm("Bạn có chắc chắn muốn nộp bài?")) submitExam(); }} style={{ background: "#059669", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}>Nộp bài</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr" }}>
        <div style={{ background: "#f8fafc", padding: "16px", borderRight: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#059669", marginBottom: "12px", letterSpacing: "0.5px" }}>DANH SÁCH CÂU HỎI</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
            {exam.map((x: Question, i: number) => (
              <button key={x.id} onClick={() => setCurrent(i)} style={{ padding: "8px", background: i === current ? "#059669" : (answers[x.id] !== undefined ? "#d1fae5" : "#fff"), color: i === current ? "#fff" : "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "12px" }}>{i + 1}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: "24px" }}>
          <div style={{ fontSize: "12px", color: "#059669", fontWeight: "600", marginBottom: "6px" }}>{sectionLabel[q.section]} · Câu {current + 1} ({q.points || 1} điểm)</div>
          <h2 style={{ fontSize: "17px", color: "#1e293b", marginBottom: "20px", lineHeight: "1.5" }}>{q.content}</h2>

          {q.section === "MCQ" && q.options?.map((o) => (
            <label key={o.key} style={{ display: "flex", gap: "12px", padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: "8px", marginBottom: "10px", cursor: "pointer", background: answers[q.id] === o.key ? "#f0fdf4" : "#fff", borderColor: answers[q.id] === o.key ? "#059669" : "#e2e8f0", transition: "all 0.2s" }}>
              <input type="radio" name={q.id} checked={answers[q.id] === o.key} onChange={() => setAnswers((a: any) => ({ ...a, [q.id]: o.key }))} />
              <span><b style={{ color: "#059669" }}>{o.key}.</b> {o.text}</span>
            </label>
          ))}

          {q.section === "SHORT" && (
            <input type="text" placeholder="Nhập câu trả lời ngắn..." value={answers[q.id] ?? ""} onChange={e => setAnswers((a: any) => ({ ...a, [q.id]: e.target.value }))} style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", outline: "none" }} />
          )}

          {q.section === "ESSAY" && (
            <div>
              <textarea 
                id="student-essay-textarea"
                rows={6}
                placeholder="Nhập bài làm tự luận của bạn..."
                value={typeof answers[q.id] === 'object' ? (answers[q.id]?.text || "") : (answers[q.id] || "")}
                onChange={e => {
                  const val = e.target.value;
                  setAnswers((prev: any) => ({
                    ...prev,
                    [q.id]: typeof prev[q.id] === 'object' && prev[q.id] !== null 
                      ? { ...prev[q.id], text: val } 
                      : { text: val, audioBlob: prev[q.id]?.audioBlob || null }
                  }));
                }}
                style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", outline: "none" }}
              />

              <div style={{ marginTop: "12px", display: "flex", gap: "12px", alignItems: "center" }}>
                {!recording ? (
                  <button type="button" onClick={startRecording} style={{ background: "#dc2626", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "12px" }}>🔴 Ghi âm giải thích</button>
                ) : (
                  <button type="button" onClick={stopRecording} style={{ background: "#475569", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "12px" }}>⏹️ Dừng ghi âm</button>
                )}
                {typeof answers[q.id] === 'object' && answers[q.id]?.audioBlob && <span style={{ color: "#059669", fontSize: "12px", fontWeight: "700" }}>✓ Đã lưu file ghi âm</span>}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
            <button disabled={current === 0} onClick={() => setCurrent((c: number) => Math.max(0, c - 1))} style={{ padding: "8px 16px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>⬅️ Câu trước</button>
            <button disabled={current === exam.length - 1} onClick={() => setCurrent((c: number) => Math.min(exam.length - 1, c + 1))} style={{ padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Câu tiếp theo ➡</button>
          </div>
        </div>
      </div>
    </div>
  );
}
