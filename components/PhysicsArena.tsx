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
  { id:"VL001", section:"MCQ", subject:"Vật lí", grade:"8", topic:"Chuyển động", difficulty:"NB", content:"Đại lượng cho biết mức độ nhanh hay chậm của chuyển động là gì?", options:[{key:"A",text:"Khối lượng"},{key:"B",text:"Vận tốc"},{key:"C",text:"Lực"},{key:"D",text:"Áp suất"}], correctOption:"B", points:.25 },
  { id:"VL002", section:"TF", subject:"Vật lí", grade:"8", topic:"Lực", difficulty:"TH", content:"Xét các nhận định về lực tác dụng.", tf:[true,false,true,false], points:1 },
  { id:"VL003", section:"SHORT", subject:"Vật lí", grade:"8", topic:"Công suất", difficulty:"VD", content:"Một máy thực hiện công 600 J trong 20 s. Công suất (W):", shortAnswer:"30", tolerance:.1, points:.5 },
  { id:"VL004", section:"ESSAY", subject:"Vật lí", grade:"8", topic:"Áp suất", difficulty:"VD", content:"Giải thích vì sao giày cao gót tạo áp suất lớn lên mặt sàn?", points:2 }
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
    const examCode = "EXAM_" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('exams').insert([{ id: examCode, title: "Kiểm tra KHTN", questions_data: exam }]);
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
    <main className="app-shell" style={{ fontFamily: "Arial, sans-serif", background: "#f8fafc", minHeight: "100vh", paddingBottom: "40px" }}>
      <header className="topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div className="brand" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="atom" style={{ fontSize: "24px" }}>⚛</span>
          <div><b style={{ fontSize: "16px", color: "#1e293b" }}>PHYSICS TEST ARENA</b><div style={{ fontSize: "11px", color: "#64748b" }}>Hệ thống kiểm tra KHTN online</div></div>
        </div>
        <div className="top-actions" style={{ display: "flex", gap: "10px" }}>
          {mode === "teacher" ? (
            <button onClick={() => setMode("student")} style={{ padding: "6px 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}>🔓 Thoát quyền GV</button>
          ) : (
            <button onClick={() => {
              const pass = prompt("Nhập mật khẩu giáo viên:");
              if (pass === "123456") setMode("teacher");
              else if (pass !== null) alert("Sai mật khẩu!");
            }} style={{ padding: "6px 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}>🔒 Giáo viên</button>
          )}
          <button className={mode === "student" ? "active" : ""} onClick={() => setMode("student")} style={{ padding: "6px 12px", background: mode === "student" ? "#2563eb" : "#f1f5f9", color: mode === "student" ? "#fff" : "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}>👨‍🎓 Học sinh</button>
        </div>
      </header>

      {notice && <div className="notice" style={{ background: "#e0f2fe", padding: "10px 20px", margin: "15px 24px", borderRadius: "8px", color: "#0369a1", display: "flex", justifyContent: "space-between" }}><span>{notice}</span><button onClick={() => setNotice("")} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>×</button></div>}

      {mode === "teacher" ? (
        <section className="workspace" style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "20px", padding: "0 24px", marginTop: "20px" }}>
          <aside className="sidebar" style={{ background: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0", height: "fit-content" }}>
            <div className="side-title" style={{ fontSize: "12px", fontWeight: "bold", color: "#64748b", marginBottom: "10px" }}>BẢNG ĐIỀU KHIỂN</div>
            {[
              ["bank", "📚", "Ngân hàng câu hỏi"],
              ["matrix", "🧩", "Ma trận & tạo đề"],
              ["exam", "📝", "Xem & Sửa đề"],
              ["grading", "✍️", "Chấm bài"],
              ["stats", "📊", "Thống kê phổ điểm"]
            ].map(([id, icon, label]) => (
              <button key={id} className={tab === id ? "nav active" : "nav"} onClick={() => setTab(id as any)} style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: tab === id ? "#eff6ff" : "transparent", color: tab === id ? "#2563eb" : "#334155", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: tab === id ? "600" : "normal", display: "flex", gap: "8px", marginBottom: "4px" }}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </aside>

          <div className="content" style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            {tab === "bank" && (
              <div>
                <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                  <div><h1 style={{ fontSize: "20px", margin: 0 }}>Ngân hàng câu hỏi</h1><p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>Quản lý chung câu hỏi trắc nghiệm, tự luận, tích hợp media.</p></div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <label className="primary-btn" style={{ background: "#16a34a", color: "#fff", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>📥 Nhập file Excel/JSON
                      <input hidden type="file" accept=".xlsx,.csv,.json" onChange={importFile} />
                    </label>
                    <button style={{ background: "#2563eb", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "13px" }} onClick={() => {
                      const newQ: Question = {
                        id: "Q_" + Date.now(),
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
                      <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                        <th style={{ padding: "8px", border: "1px solid #cbd5e1" }}>ID</th>
                        <th style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Phần</th>
                        <th style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Nội dung</th>
                        <th style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Media đính kèm</th>
                        <th style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Xóa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q, index) => (
                        <tr key={q.id || index}>
                          <td style={{ padding: "8px", border: "1px solid #cbd5e1" }}><b>{q.id}</b></td>
                          <td style={{ padding: "8px", border: "1px solid #cbd5e1" }}>{sectionLabel[q.section]}</td>
                          <td style={{ padding: "8px", border: "1px solid #cbd5e1" }}>{q.content}</td>
                          <td style={{ padding: "8px", border: "1px solid #cbd5e1" }}>
                            {q.videoUrl && <span style={{ color: "#2563eb", marginRight: "8px" }}>🎥 Có video</span>}
                            {q.audioUrl && <span style={{ color: "#16a34a" }}>🔊 Có âm thanh</span>}
                            {!q.videoUrl && !q.audioUrl && <span style={{ color: "#94a3b8" }}>Không có</span>}
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #cbd5e1" }}>
                            <button style={{ background: "#fee2e2", color: "#991b1b", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }} onClick={() => { if (confirm("Xóa câu này?")) setQuestions(prev => prev.filter((_, i) => i !== index)); }}>🗑️</button>
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
                <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
                  <div><h1 style={{ fontSize: "20px", margin: 0 }}>Ma trận & tạo đề</h1><p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>Chọn số lượng câu và xuất link giao bài cho học sinh.</p></div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={generateExam} style={{ background: "#2563eb", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Tạo đề thi</button>
                    <button onClick={handlePublishAndGetLink} style={{ background: "#16a34a", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>🔗 Xuất link gửi học sinh</button>
                  </div>
                </div>
                {(Object.keys(matrix) as Section[]).map(sec => (
                  <div key={sec} style={{ display: "grid", gridTemplateColumns: "200px repeat(4, 1fr)", gap: "10px", alignItems: "center", marginBottom: "10px", background: "#f8fafc", padding: "10px", borderRadius: "6px" }}>
                    <strong>{sectionLabel[sec]}</strong>
                    {(["NB", "TH", "VD", "VDC"] as Difficulty[]).map(d => (
                      <div key={d} style={{ display: "flex", flexDirection: "column" }}>
                        <label style={{ fontSize: "11px", color: "#64748b" }}>{diffLabel[d]}</label>
                        <input type="number" min="0" value={matrix[sec][d]} onChange={e => updateMatrix(sec, d, Number(e.target.value))} style={{ padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {tab === "exam" && (
              <div>
                <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                  <div><h1 style={{ fontSize: "20px", margin: 0 }}>Xem & Chỉnh sửa đề thi hiện tại</h1><p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>Thầy có thể sửa trực tiếp nội dung câu hỏi, link media hoặc đáp án nếu chưa phù hợp.</p></div>
                  <button onClick={generateExam} style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", padding: "6px 12px", borderRadius: "6px", cursor: "pointer" }}>🔄 Tạo đề mới</button>
                </div>
                {exam.length === 0 ? <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>Chưa có đề. Vui lòng vào Ma trận & tạo đề.</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                    {exam.map((q, i) => (
                      <div key={q.id} style={{ border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px", background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontWeight: "bold", color: "#2563eb" }}>Câu {i + 1} ({q.section})</span>
                          <span style={{ fontSize: "12px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>Điểm: {q.points}</span>
                        </div>
                        <input 
                          type="text" 
                          value={q.content} 
                          onChange={e => {
                            const val = e.target.value;
                            setExam(prev => prev.map((item, idx) => idx === i ? { ...item, content: val } : item));
                          }}
                          style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px", marginBottom: "8px", fontWeight: "600" }} 
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
                          <div>
                            <label style={{ fontSize: "12px", color: "#64748b" }}>Link Video (YouTube/MP4):</label>
                            <input 
                              type="text" 
                              placeholder="https://..." 
                              value={q.videoUrl || ""} 
                              onChange={e => {
                                const val = e.target.value;
                                setExam(prev => prev.map((item, idx) => idx === i ? { ...item, videoUrl: val } : item));
                              }}
                              style={{ width: "100%", padding: "6px", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "13px" }} 
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "12px", color: "#64748b" }}>Link Âm thanh (MP3):</label>
                            <input 
                              type="text" 
                              placeholder="https://..." 
                              value={q.audioUrl || ""} 
                              onChange={e => {
                                const val = e.target.value;
                                setExam(prev => prev.map((item, idx) => idx === i ? { ...item, audioUrl: val } : item));
                              }}
                              style={{ width: "100%", padding: "6px", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "13px" }} 
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
                <h1 style={{ fontSize: "20px", marginBottom: "5px" }}>Chấm bài học sinh</h1>
                <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "15px" }}>Tổng điểm tự động + Chấm tự luận thủ công.</p>
                <div style={{ display: "flex", gap: "15px", background: "#f8fafc", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
                  <div>Trắc nghiệm: <b>{autoScore.toFixed(2)}</b></div>
                  <div>Tự luận: <b>{essayTotalScore.toFixed(2)}</b></div>
                  <div>Tổng điểm: <b style={{ color: "#16a34a" }}>{finalScore.toFixed(2)}</b></div>
                </div>
                {exam.filter(q => q.section === "ESSAY").map(q => (
                  <div key={q.id} style={{ border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px", marginBottom: "15px" }}>
                    <p style={{ fontWeight: "bold" }}>{q.content}</p>
                    <div style={{ background: "#f1f5f9", padding: "10px", borderRadius: "6px", marginBottom: "10px" }}>
                      <b>Bài làm văn bản:</b> {typeof answers[q.id] === 'object' ? answers[q.id]?.text : (answers[q.id] || "Chưa làm")}
                      {answers[q.id]?.audioBlob && (
                        <div style={{ marginTop: "8px" }}>
                          <b>File ghi âm của học sinh:</b><br />
                          <audio controls src={URL.createObjectURL(answers[q.id].audioBlob)} style={{ marginTop: "4px" }} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <label style={{ fontSize: "13px" }}>Cho điểm:</label>
                      <input 
                        type="number" 
                        min="0" 
                        max={q.points || 1} 
                        step="0.25" 
                        value={essayScores[q.id] ?? ""} 
                        onChange={e => setEssayScores(prev => ({ ...prev, [q.id]: parseFloat(e.target.value) || 0 }))}
                        style={{ width: "80px", padding: "6px", border: "1px solid #cbd5e1", borderRadius: "4px" }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "stats" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                  <div><h1 style={{ fontSize: "20px", margin: 0 }}>Thống kê phổ điểm</h1><p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>Phân tích kết quả kiểm tra.</p></div>
                  <button onClick={() => window.print()} style={{ background: "#0284c7", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>📥 Xuất báo cáo PDF</button>
                </div>
                <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                  <h3 style={{ color: "#1e293b" }}>Điểm tổng kết học sinh: {finalScore.toFixed(2)} điểm</h3>
                  <p style={{ color: "#64748b" }}>Hệ thống đã ghi nhận đầy đủ kết quả trắc nghiệm và tự luận.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <StudentView exam={exam} answers={answers} setAnswers={setAnswers} current={current} setCurrent={setCurrent} seconds={seconds} setSeconds={setSeconds} studentName={studentName} setStudentName={setStudentName} submitExam={submitExam} submitted={submitted} autoScore={autoScore} essayScores={essayScores} />
      )}

      <footer style={{ textAlign: "center", marginTop: "30px", fontSize: "12px", color: "#64748b" }}>⚡ Physics Test Arena · Tích hợp Media & Bàn phím ký hiệu thông minh</footer>
    </main>
  );
}

function StudentView({ exam, answers, setAnswers, current, setCurrent, seconds, setSeconds, studentName, setStudentName, submitExam, submitted, autoScore, essayScores }: any) {
  const q = exam[current];
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>(null as any);

  // Dùng useRef để lưu hàm submitExam tránh việc useEffect bị kích hoạt lại
  const submitExamRef = useRef(submitExam);
  useEffect(() => {
    submitExamRef.current = submitExam;
  }, [submitExam]);

  // TIMER DÙNG useRef ĐẢM BẢO CHẠY ỔN ĐỊNH XUYÊN SUỐT KHÔNG BAO GIỜ BỊ RESET
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
    const text = typeof answers[q.id] === 'object' ? (answers[q.id]?.text || "") : (answers[q.id] || "");
    const newText = text.substring(0, start) + symbol + text.substring(end);
    
    setAnswers((prev: any) => ({
      ...prev,
      [q.id]: typeof prev[q.id] === 'object' && prev[q.id] !== null 
        ? { ...prev[q.id], text: newText } 
        : { text: newText, audioBlob: prev[q.id]?.audioBlob || null }
    }));
  };

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
      <h1 style={{ color: "#1e293b", marginBottom: "10px" }}>PHÒNG THI TRỰC TUYẾN KHTN</h1>
      <p style={{ color: "#64748b", marginBottom: "20px" }}>Nhập thông tin để bắt đầu làm bài kiểm tra.</p>
      <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0", width: "100%", maxWidth: "380px", textAlign: "left", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>Họ và tên học sinh:</label>
          <input type="text" placeholder="Nguyễn Văn A" value={studentName} onChange={e => setStudentName(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px", marginTop: "4px" }} />
        </div>
        <button onClick={() => { if (!studentName.trim()) { alert("Vui lòng nhập tên!"); return; } setStarted(true); }} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>🚀 Bắt đầu làm bài</button>
      </div>
    </div>
  );

  if (!exam.length) return <div style={{ textAlign: "center", padding: "40px" }}>Đang tải đề thi...</div>;

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (submitted) {
    return (
      <div style={{ maxWidth: "700px", margin: "20px auto", background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
        <h2 style={{ textAlign: "center", color: "#1e293b" }}>🎉 ĐÃ NỘP BÀI THÀNH CÔNG!</h2>
        <p style={{ textAlign: "center", color: "#64748b" }}>Học sinh: <b>{studentName}</b></p>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "15px", borderRadius: "6px", textAlign: "center", marginTop: "15px" }}>
          Điểm trắc nghiệm tự động: <b style={{ color: "#16a34a", fontSize: "18px" }}>{autoScore.toFixed(2)}</b>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Phần tự luận & ghi âm sẽ được giáo viên chấm chi tiết sau.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "20px auto", background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <div><b>{studentName}</b></div>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <div style={{ fontWeight: "bold", color: seconds < 60 ? "#dc2626" : "#0f172a" }}>⏱️ {mm}:{ss}</div>
          <button onClick={() => { if (confirm("Nộp bài thi?")) submitExam(); }} style={{ background: "#16a34a", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", fontWeight: "600", cursor: "pointer" }}>Nộp bài</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr" }}>
        <div style={{ background: "#f8fafc", padding: "15px", borderRight: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", fontWeight: "bold", color: "#64748b", marginBottom: "10px" }}>CÂU HỎI</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
            {exam.map((x: any, i: number) => (
              <button key={x.id} onClick={() => setCurrent(i)} style={{ padding: "8px", background: i === current ? "#2563eb" : (answers[x.id] !== undefined ? "#e0f2fe" : "#fff"), color: i === current ? "#fff" : "#0f172a", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>{i + 1}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>{sectionLabel[q.section]} · Câu {current + 1}</div>
          <h2 style={{ fontSize: "16px", color: "#1e293b", marginBottom: "15px" }}>{q.content}</h2>

          {q.videoUrl && (
            <div style={{ marginBottom: "15px" }}>
              <iframe width="100%" height="250" src={q.videoUrl.replace("watch?v=", "embed/")} title="Video minh họa" style={{ border: "0", borderRadius: "6px" }} allowFullScreen />
            </div>
          )}

          {q.audioUrl && (
            <div style={{ marginBottom: "15px", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "5px" }}>🔊 Nghe âm thanh câu hỏi:</div>
              <audio controls src={q.audioUrl} style={{ width: "100%" }} />
            </div>
          )}

          {q.section === "MCQ" && q.options?.map((o: any) => (
            <label key={o.key} style={{ display: "flex", gap: "10px", padding: "10px", border: "1px solid #e2e8f0", borderRadius: "6px", marginBottom: "8px", cursor: "pointer", background: answers[q.id] === o.key ? "#eff6ff" : "#fff" }}>
              <input type="radio" name={q.id} checked={answers[q.id] === o.key} onChange={() => setAnswers((a: any) => ({ ...a, [q.id]: o.key }))} />
              <span><b>{o.key}.</b> {o.text}</span>
            </label>
          ))}

          {q.section === "SHORT" && (
            <input type="text" placeholder="Nhập câu trả lời ngắn..." value={answers[q.id] ?? ""} onChange={e => setAnswers((a: any) => ({ ...a, [q.id]: e.target.value }))} style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
          )}

          {q.section === "ESSAY" && (
            <div>
              <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "8px", background: "#f1f5f9", padding: "6px", borderRadius: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", alignSelf: "center", marginRight: "5px" }}>Ký hiệu nhanh:</span>
                {["/ (Phân số)", "· (Nhân)", "² (Bình phương)", "³ (Lập phương)", "√ (Căn)", "→ (Suy ra)", "°C (Độ C)", "Δ (Delta)", "α", "β", "λ"].map(sym => (
                  <button key={sym} type="button" onClick={() => insertSymbol(sym.split(" ")[0])} style={{ padding: "4px 8px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>{sym}</button>
                ))}
              </div>

              <textarea 
                id="student-essay-textarea"
                rows={5}
                placeholder="Nhập bài làm tự luận chi tiết..."
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
                style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", fontFamily: "inherit" }}
              />

              <div style={{ marginTop: "12px", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "10px" }}>
                {!recording ? (
                  <button type="button" onClick={startRecording} style={{ background: "#dc2626", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>🔴 Ghi âm câu trả lời</button>
                ) : (
                  <button type="button" onClick={stopRecording} style={{ background: "#475569", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>⏹️ Dừng ghi âm</button>
                )}
                {answers[q.id]?.audioBlob && <span style={{ color: "#16a34a", fontSize: "13px", fontWeight: "600" }}>✓ Đã lưu file ghi âm lý thuyết</span>}
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
