"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type Section = "MCQ" | "TF" | "SHORT" | "ESSAY";
type Difficulty = "NB" | "TH" | "VD" | "VDC";

type SubTFItem = {
  id: string;
  content: string;
  key: boolean;
  difficulty: Difficulty;
};

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
  imageUrl?: string;
  options?: { key: string; text: string }[];
  correctOption?: string;
  subTfs?: SubTFItem[];
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
  { 
    id: "KHTN001", 
    section: "MCQ", 
    subject: "Khoa học tự nhiên", 
    grade: "7", 
    topic: "Tốc độ chuyển động", 
    difficulty: "NB", 
    content: "Đại lượng cho biết mức độ nhanh hay chậm của chuyển động là:", 
    options: [{key:"A",text:"Khối lượng"},{key:"B",text:"Vận tốc"},{key:"C",text:"Lực"},{key:"D",text:"Áp suất"}], 
    correctOption: "B", 
    points: 0.25 
  },
  { 
    id: "KHTN002", 
    section: "TF", 
    subject: "Khoa học tự nhiên", 
    grade: "7", 
    topic: "Ánh sáng", 
    difficulty: "TH", 
    content: "Các nhận định về hiện tượng phản xạ ánh sáng:", 
    subTfs: [
      { id: "a", content: "Tia phản xạ nằm trong mặt phẳng chứa tia tới và pháp tuyến.", key: true, difficulty: "NB" },
      { id: "b", content: "Góc phản xạ luôn lớn hơn góc tới.", key: false, difficulty: "TH" },
      { id: "c", content: "Góc phản xạ bằng góc tới.", key: true, difficulty: "NB" },
      { id: "d", content: "Khi thay đổi góc tới thì góc phản xạ không đổi.", key: false, difficulty: "VD" }
    ], 
    points: 1.0 
  },
  { 
    id: "KHTN003", 
    section: "SHORT", 
    subject: "Khoa học tự nhiên", 
    grade: "7", 
    topic: "Âm thanh", 
    difficulty: "VD", 
    content: "Một nguồn âm dao động thực hiện 600 dao động trong 20 giây. Tần số dao động của nguồn âm là (Hz):", 
    shortAnswer: "30", 
    tolerance: 0.1, 
    points: 0.5 
  },
  { 
    id: "KHTN004", 
    section: "ESSAY", 
    subject: "Khoa học tự nhiên", 
    grade: "7", 
    topic: "Trao đổi chất", 
    difficulty: "VD", 
    content: "Giải thích vai trò của quá trình quang hợp đối với sự sống trên Trái Đất?", 
    points: 2.0 
  }
];

const defaultMatrix: Matrix = {
  MCQ: { NB: 1, TH: 1, VD: 0, VDC: 0 },
  TF: { NB: 0, TH: 1, VD: 0, VDC: 0 },
  SHORT: { NB: 0, TH: 1, VD: 0, VDC: 0 },
  ESSAY: { NB: 0, TH: 0, VD: 1, VDC: 0 }
};

const sectionLabel: Record<Section, string> = { 
  MCQ: "Phần I: Trắc nghiệm nhiều lựa chọn", 
  TF: "Phần II: Trắc nghiệm đúng / sai", 
  SHORT: "Phần III: Trắc nghiệm trả lời ngắn", 
  ESSAY: "Phần IV: Tự luận" 
};

const diffLabel: Record<Difficulty, string> = { NB: "Nhận biết", TH: "Thông hiểu", VD: "Vận dụng", VDC: "Vận dụng cao" };

function shuffle<T>(arr: T[]): T[] {
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
    ...shuffleArray(mcq).map(q => q.options ? { ...q, options: shuffleArray(q.options) } : q),
    ...shuffleArray(tf),
    ...shuffleArray(short),
    ...shuffleArray(essay)
  ];
}

function scoreTF(userAns: Record<string, boolean> | undefined, subTfs: SubTFItem[] | undefined, totalPoint: number): number {
  if (!subTfs || !userAns) return 0;
  let wrongCount = 0;
  subTfs.forEach(sub => {
    const uVal = userAns[sub.id];
    if (uVal === undefined || uVal !== sub.key) {
      wrongCount++;
    }
  });
  let deduction = 0;
  if (wrongCount === 1) deduction = 0.25 * totalPoint;
  else if (wrongCount === 2) deduction = 0.50 * totalPoint;
  else if (wrongCount === 3) deduction = 0.75 * totalPoint;
  else if (wrongCount >= 4) deduction = totalPoint;

  return Math.max(0, totalPoint - deduction);
}

function parseRow(r: any): Question {
  const section = String(r.section || "MCQ").toUpperCase() as Section;
  const options = ["A", "B", "C", "D"].map(k => ({ key: k, text: String(r[`option${k}`] ?? r[`option_${k.toLowerCase()}`] ?? "") })).filter(x => x.text);
  
  const subTfs: SubTFItem[] = ["a", "b", "c", "d"].map((id) => ({
    id,
    content: String(r[`tf_content_${id}`] || `Nhận định ${id.toUpperCase()}`),
    key: String(r[`tf_key_${id}`]).toLowerCase() === "true" || r[`tf_key_${id}`] === 1,
    difficulty: (String(r[`tf_diff_${id}`] || "TH").toUpperCase() as Difficulty)
  }));

  return {
    id: String(r.id || crypto.randomUUID()),
    section,
    subject: String(r.subject || "Khoa học tự nhiên"),
    grade: String(r.grade || "7"),
    topic: String(r.topic || "Chưa phân loại"),
    difficulty: (String(r.difficulty || "TH").toUpperCase() as Difficulty),
    content: String(r.content || ""),
    videoUrl: String(r.videoUrl || "") || undefined,
    audioUrl: String(r.audioUrl || "") || undefined,
    imageUrl: String(r.imageUrl || "") || undefined,
    options: options.length ? options : undefined,
    correctOption: String(r.correctOption || ""),
    subTfs: section === "TF" ? subTfs : undefined,
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
  const [examMinutes, setExamMinutes] = useState<number>(45); 
  const [exam, setExam] = useState<Question[]>([]);
  const [examCodeId, setExamCodeId] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [studentSchool, setStudentSchool] = useState("");

  const [seconds, setSeconds] = useState(45 * 60);
  const [essayScores, setEssayScores] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (mode === "student" && exam.length > 0 && !submitted) {
      const timer = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [mode, exam, submitted]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const examId = params.get("exam");
    if (examId) {
      setMode("student");
      setExamCodeId(examId);
      async function fetchExamFromCloud() {
        const { data } = await supabase.from('exams').select('questions_data, duration').eq('id', examId).single();
        if (data && data.questions_data) {
          setExam(data.questions_data);
          if (data.duration) {
            setExamMinutes(data.duration);
            setSeconds(data.duration * 60);
          }
          setNotice(`Đã tải thành công đề thi (${examId}) cho học sinh.`);
        } else {
          alert("Không tìm thấy mã đề thi này hoặc link không hợp lệ!");
        }
      }
      fetchExamFromCloud();
    }
  }, []);

  const autoScore = useMemo(() => {
    return exam.reduce((s, q) => {
      const a = answers[q.id];
      if (q.section === "MCQ") return s + (a === q.correctOption ? q.points : 0);
      if (q.section === "TF") return s + scoreTF(a, q.subTfs, q.points);
      if (q.section === "SHORT") {
        const n = Number(a); 
        const key = Number(q.shortAnswer);
        return s + (Number.isFinite(n) && Math.abs(n - key) <= Number(q.tolerance || 0) ? q.points : 0);
      }
      return s;
    }, 0);
  }, [exam, answers]);
  
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
    setSeconds(examMinutes * 60);
    setTab("exam");
    setNotice(`Đã tạo đề ${randomized.length} câu thành công với thời gian ${examMinutes} phút.`);
  }

  async function handlePublishAndGetLink() {
    if (exam.length === 0) {
      alert("Chưa có đề thi nào được tạo! Thầy hãy bấm 'Tạo đề thi' trước.");
      return;
    }
    const examCode = "KHTN_" + Math.random().toString(36).substring(2, 8).toUpperCase();
    setExamCodeId(examCode);
    const { error } = await supabase.from('exams').insert([{ 
      id: examCode, 
      title: "Kiểm tra Khoa học tự nhiên", 
      duration: examMinutes,
      questions_data: exam 
    }]);
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
      } catch { 
        setNotice("Không đọc được file. Hãy kiểm tra định dạng mẫu."); 
      }
    };
    if (file.name.endsWith(".json")) reader.readAsText(file); else reader.readAsArrayBuffer(file);
  }

  async function submitExam() {
    setSubmitted(true);
    setTab("grading");

    const { error } = await supabase.from('student_submissions').insert([{
      exam_id: examCodeId || "LOCAL_TEST",
      student_name: studentName,
      student_class: studentClass,
      student_school: studentSchool,
      auto_score: autoScore,
      answers_data: answers,
      submitted_at: new Date().toISOString()
    }]);

    if (error) {
      console.error("Không thể lưu kết quả lên Cloud:", error.message);
    }

    setNotice("Bài đã được nộp và lưu lên hệ thống thành công!");
  }

  return (
    <main className="app-shell" style={{ 
      fontFamily: "Inter, system-ui, Arial, sans-serif", 
      background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)", 
      minHeight: "100vh", 
      paddingBottom: "40px",
      color: "#0f172a"
    }}>
      <header className="topbar" style={{ 
        display: "flex", justifyContent: "space-between", alignItems: "center", 
        padding: "16px 28px", background: "#ffffff", 
        borderBottom: "3px solid #0d9488", 
        boxShadow: "0 10px 25px -5px rgba(13, 148, 136, 0.15)" 
      }}>
        <div className="brand" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span className="atom" style={{ fontSize: "32px", background: "#ccfbf1", padding: "8px 12px", borderRadius: "14px", border: "2px solid #2dd4bf" }}>🔬</span>
          <div>
            <h1 style={{ 
              fontSize: "22px", margin: 0, fontWeight: "900", color: "#0f766e",
              textShadow: "2px 2px 0px #99f6e4, 4px 4px 0px rgba(13,148,136,0.2)",
              letterSpacing: "0.5px"
            }}>
              ĐẤU TRƯỜNG KHOA HỌC TỰ NHIÊN
            </h1>
            <div style={{ fontSize: "12px", color: "#047857", fontWeight: "700", marginTop: "2px" }}>
              Hệ thống ôn tập & kiểm tra trực tuyến chuẩn cấp 2
            </div>
          </div>
        </div>
        <div className="top-actions" style={{ display: "flex", gap: "10px" }}>
          {mode === "teacher" ? (
            <button onClick={() => setMode("student")} style={{ padding: "8px 14px", background: "#f0fdf4", border: "1px solid #5eead4", borderRadius: "8px", cursor: "pointer", fontWeight: "700", color: "#0f766e" }}>🔓 Thoát quyền GV</button>
          ) : (
            <button onClick={() => {
              const pass = prompt("Nhập mật khẩu giáo viên:");
              if (pass === "123456") setMode("teacher");
              else if (pass !== null) alert("Sai mật khẩu!");
            }} style={{ padding: "8px 14px", background: "#f0fdf4", border: "1px solid #5eead4", borderRadius: "8px", cursor: "pointer", fontWeight: "700", color: "#0f766e" }}>🔒 Giáo viên</button>
          )}
          <button className={mode === "student" ? "active" : ""} onClick={() => setMode("student")} style={{ padding: "8px 14px", background: mode === "student" ? "#0d9488" : "#f0fdf4", color: mode === "student" ? "#fff" : "#0f766e", border: "1px solid #5eead4", borderRadius: "8px", cursor: "pointer", fontWeight: "700" }}>👨‍🎓 Học sinh</button>
        </div>
      </header>

      {notice && <div className="notice" style={{ background: "#f0fdf4", border: "1px solid #5eead4", padding: "12px 24px", margin: "20px 28px", borderRadius: "10px", color: "#115e59", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}><span>{notice}</span><button onClick={() => setNotice("")} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "16px", color: "#0f766e" }}>×</button></div>}

      {mode === "teacher" ? (
        <section className="workspace" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "24px", padding: "0 28px", marginTop: "24px" }}>
          <aside className="sidebar" style={{ background: "#ffffff", padding: "18px", borderRadius: "14px", border: "1px solid #cbd5e1", height: "fit-content", boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.05)" }}>
            <div className="side-title" style={{ fontSize: "11px", fontWeight: "700", color: "#0d9488", marginBottom: "12px", letterSpacing: "1px" }}>BẢNG ĐIỀU KHIỂN KHTN</div>
            {[
              ["bank", "📚", "Ngân hàng câu hỏi"],
              ["matrix", "🧩", "Ma trận & tạo đề"],
              ["exam", "📝", "Xem & Sửa đề"],
              ["grading", "✍️", "Chấm bài tự luận"],
              ["stats", "📊", "Thống kê phổ điểm"]
            ].map(([id, icon, label]) => (
              <button key={id} className={tab === id ? "nav active" : "nav"} onClick={() => setTab(id as any)} style={{ width: "100%", textAlign: "left", padding: "12px 14px", background: tab === id ? "#ccfbf1" : "transparent", color: tab === id ? "#115e59" : "#334155", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: tab === id ? "700" : "500", display: "flex", gap: "10px", marginBottom: "6px", transition: "all 0.2s" }}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </aside>

          <div className="content" style={{ background: "#ffffff", padding: "24px", borderRadius: "14px", border: "1px solid #cbd5e1", boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.05)" }}>
            {tab === "bank" && (
              <div>
                <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div><h2 style={{ fontSize: "20px", margin: 0, color: "#0f766e" }}>Ngân hàng câu hỏi KHTN</h2><p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>Quản lý câu hỏi, tích hợp đầy đủ file ảnh, video và bản ghi âm.</p></div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <label className="primary-btn" style={{ background: "#0d9488", color: "#fff", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "6px" }}>📥 Nhập file Excel/JSON
                      <input hidden type="file" accept=".xlsx,.csv,.json" onChange={importFile} />
                    </label>
                    <button style={{ background: "#0284c7", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "13px" }} onClick={() => {
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
                      <tr style={{ background: "#f8fafc", textAlign: "left", color: "#0f766e" }}>
                        <th style={{ padding: "10px", border: "1px solid #cbd5e1" }}>ID</th>
                        <th style={{ padding: "10px", border: "1px solid #cbd5e1" }}>Phần</th>
                        <th style={{ padding: "10px", border: "1px solid #cbd5e1" }}>Nội dung</th>
                        <th style={{ padding: "10px", border: "1px solid #cbd5e1" }}>Media (Ảnh / Video / Audio)</th>
                        <th style={{ padding: "10px", border: "1px solid #cbd5e1" }}>Xóa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q, index) => (
                        <tr key={q.id || index}>
                          <td style={{ padding: "10px", border: "1px solid #cbd5e1" }}><b>{q.id}</b></td>
                          <td style={{ padding: "10px", border: "1px solid #cbd5e1" }}>{sectionLabel[q.section]}</td>
                          <td style={{ padding: "10px", border: "1px solid #cbd5e1" }}>{q.content}</td>
                          <td style={{ padding: "10px", border: "1px solid #cbd5e1" }}>
                            {q.imageUrl && <span style={{ color: "#0284c7", marginRight: "6px" }}>🖼️ Ảnh</span>}
                            {q.videoUrl && <span style={{ color: "#7c3aed", marginRight: "6px" }}>🎥 Video</span>}
                            {q.audioUrl && <span style={{ color: "#059669" }}>🔊 Audio</span>}
                            {!q.imageUrl && !q.videoUrl && !q.audioUrl && <span style={{ color: "#94a3b8" }}>Không có</span>}
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
                  <div><h2 style={{ fontSize: "20px", margin: 0, color: "#0f766e" }}>Ma trận & Tạo đề</h2><p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>Cấu hình số lượng câu hỏi và chọn thời gian bài thi.</p></div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f0fdf4", padding: "6px 12px", borderRadius: "8px", border: "1px solid #5eead4" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f766e" }}>⏱️ Thời gian:</span>
                      <select value={examMinutes} onChange={e => setExamMinutes(Number(e.target.value))} style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontWeight: "600" }}>
                        <option value={15}>15 phút</option>
                        <option value={30}>30 phút</option>
                        <option value={45}>45 phút</option>
                        <option value={60}>60 phút</option>
                        <option value={90}>90 phút</option>
                      </select>
                    </div>
                    <button onClick={generateExam} style={{ background: "#0d9488", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Tạo đề thi</button>
                    <button onClick={handlePublishAndGetLink} style={{ background: "#0284c7", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>🔗 Xuất link gửi học sinh</button>
                  </div>
                </div>
                {(Object.keys(matrix) as Section[]).map(sec => (
                  <div key={sec} style={{ display: "grid", gridTemplateColumns: "220px repeat(4, 1fr)", gap: "12px", alignItems: "center", marginBottom: "12px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <strong style={{ color: "#0f766e", fontSize: "13px" }}>{sectionLabel[sec]}</strong>
                    {(["NB", "TH", "VD", "VDC"] as Difficulty[]).map(d => (
                      <div key={d} style={{ display: "flex", flexDirection: "column" }}>
                        <label style={{ fontSize: "11px", color: "#0d9488", fontWeight: "600" }}>{diffLabel[d]}</label>
                        <input type="number" min="0" value={matrix[sec][d]} onChange={e => updateMatrix(sec, d, Number(e.target.value))} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff" }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {tab === "exam" && (
              <div>
                <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div><h2 style={{ fontSize: "20px", margin: 0, color: "#0f766e" }}>Xem & Chỉnh sửa đề thi hiện tại</h2><p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>Quản lý nội dung, link Ảnh, Video và Bản ghi âm cho từng câu hỏi.</p></div>
                  <button onClick={generateExam} style={{ background: "#f0fdf4", border: "1px solid #5eead4", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", color: "#0f766e" }}>🔄 Tạo đề mới</button>
                </div>
                {exam.length === 0 ? <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>Chưa có đề. Vui lòng vào Ma trận & tạo đề.</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                    {exam.map((q, i) => (
                      <div key={q.id} style={{ border: "1px solid #cbd5e1", padding: "16px", borderRadius: "10px", background: "#fdfefe" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontWeight: "700", color: "#0d9488" }}>Câu {i + 1} ({q.section})</span>
                          <span style={{ fontSize: "12px", background: "#f0fdf4", color: "#0f766e", padding: "2px 8px", borderRadius: "4px", border: "1px solid #5eead4" }}>Điểm: {q.points}</span>
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
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "8px" }}>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: "600", color: "#0284c7" }}>🖼️ Link Ảnh minh họa:</label>
                            <input 
                              type="text" 
                              placeholder="https://... image.png" 
                              value={q.imageUrl || ""} 
                              onChange={e => {
                                const val = e.target.value;
                                setExam(prev => prev.map((item, idx) => idx === i ? { ...item, imageUrl: val } : item));
                              }}
                              style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12px" }} 
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: "600", color: "#7c3aed" }}>🎥 Link Video (Nghe):</label>
                            <input 
                              type="text" 
                              placeholder="https://... video.mp4" 
                              value={q.videoUrl || ""} 
                              onChange={e => {
                                const val = e.target.value;
                                setExam(prev => prev.map((item, idx) => idx === i ? { ...item, videoUrl: val } : item));
                              }}
                              style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12px" }} 
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: "600", color: "#059669" }}>🔊 Link Bản ghi âm (Audio):</label>
                            <input 
                              type="text" 
                              placeholder="https://... audio.mp3" 
                              value={q.audioUrl || ""} 
                              onChange={e => {
                                const val = e.target.value;
                                setExam(prev => prev.map((item, idx) => idx === i ? { ...item, audioUrl: val } : item));
                              }}
                              style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12px" }} 
                            />
                          </div>
                        </div>

                        {q.section === "TF" && q.subTfs && (
                          <div style={{ marginTop: "12px", background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                            <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f766e", marginBottom: "6px" }}>Cấu hình 4 ý (a, b, c, d) & Mức độ riêng:</div>
                            {q.subTfs.map((sub, sIdx) => (
                              <div key={sub.id} style={{ display: "grid", gridTemplateColumns: "30px 1fr 100px 90px", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                                <b style={{ color: "#0284c7" }}>{sub.id.toUpperCase()}.</b>
                                <input 
                                  type="text" 
                                  value={sub.content} 
                                  onChange={e => {
                                    const val = e.target.value;
                                    setExam(prev => prev.map((item, idx) => idx === i ? {
                                      ...item,
                                      subTfs: item.subTfs?.map((s, sI) => sI === sIdx ? { ...s, content: val } : s)
                                    } : item));
                                  }}
                                  style={{ padding: "4px 8px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                                />
                                <select 
                                  value={sub.difficulty}
                                  onChange={e => {
                                    const val = e.target.value as Difficulty;
                                    setExam(prev => prev.map((item, idx) => idx === i ? {
                                      ...item,
                                      subTfs: item.subTfs?.map((s, sI) => sI === sIdx ? { ...s, difficulty: val } : s)
                                    } : item));
                                  }}
                                  style={{ padding: "4px", fontSize: "11px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                                >
                                  <option value="NB">Nhận biết</option>
                                  <option value="TH">Thông hiểu</option>
                                  <option value="VD">Vận dụng</option>
                                </select>
                                <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: "600" }}>
                                  <input 
                                    type="checkbox" 
                                    checked={sub.key} 
                                    onChange={e => {
                                      const val = e.target.checked;
                                      setExam(prev => prev.map((item, idx) => idx === i ? {
                                        ...item,
                                        subTfs: item.subTfs?.map((s, sI) => sI === sIdx ? { ...s, key: val } : s)
                                      } : item));
                                    }}
                                  /> Đúng
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "grading" && (
              <div>
                <h2 style={{ fontSize: "20px", color: "#0f766e", marginBottom: "10px" }}>Chấm bài & Tổng kết điểm</h2>
                <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "20px" }}>Xem kết quả tự động chấm và nhập điểm tự luận cho học sinh.</p>
                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f766e", marginBottom: "10px" }}>Điểm hệ thống tự chấm: {autoScore.toFixed(2)}</div>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: "#0284c7", marginBottom: "10px" }}>Điểm tự luận: {essayTotalScore.toFixed(2)}</div>
                  <div style={{ fontSize: "18px", fontWeight: "900", color: "#047857" }}>Tổng điểm bài thi: {finalScore.toFixed(2)}</div>
                </div>
              </div>
            )}

            {tab === "stats" && (
              <div>
                <h2 style={{ fontSize: "20px", color: "#0f766e", marginBottom: "10px" }}>Thống kê phổ điểm</h2>
                <p style={{ color: "#64748b", fontSize: "13px" }}>Phân tích kết quả làm bài của toàn bộ học sinh.</p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section style={{ maxWidth: "800px", margin: "24px auto", background: "#fff", padding: "30px", borderRadius: "14px", border: "1px solid #cbd5e1", boxShadow: "0 4px 12px -2px rgba(0,0,0,0.05)" }}>
          {!submitted ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #0d9488", paddingBottom: "15px", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ margin: 0, color: "#0f766e", fontSize: "20px" }}>Bài kiểm tra Khoa học tự nhiên</h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>Điền đầy đủ thông tin cá nhân và hoàn thành các câu hỏi dưới đây.</p>
                </div>
                <div style={{ background: "#ccfbf1", color: "#115e59", padding: "8px 14px", borderRadius: "8px", fontWeight: "700", border: "1px solid #2dd4bf" }}>
                  ⏱️ Thời gian: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
                <input type="text" placeholder="Họ và tên học sinh" value={studentName} onChange={e => setStudentName(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                <input type="text" placeholder="Lớp (Ví dụ: 7A)" value={studentClass} onChange={e => setStudentClass(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                <input type="text" placeholder="Trường học" value={studentSchool} onChange={e => setStudentSchool(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
              </div>

              {exam.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Chưa có đề thi nào được tải. Vui lòng kiểm tra lại đường link hoặc yêu cầu giáo viên cung cấp đề.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {exam.map((q, qIdx) => (
                    <div key={q.id} style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                      <div style={{ fontWeight: "700", color: "#0f766e", marginBottom: "8px" }}>Câu {qIdx + 1}: {q.content}</div>
                      
                      {q.imageUrl && <img src={q.imageUrl} alt="minh họa" style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "6px", marginBottom: "10px" }} />}

                      {q.section === "MCQ" && q.options && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {q.options.map(opt => (
                            <label key={opt.key} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                              <input 
                                type="radio" 
                                name={`q_${q.id}`} 
                                checked={answers[q.id] === opt.key} 
                                onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt.key }))} 
                              />
                              <b>{opt.key}.</b> {opt.text}
                            </label>
                          ))}
                        </div>
                      )}

                      {q.section === "TF" && q.subTfs && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {q.subTfs.map(sub => (
                            <div key={sub.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                              <span style={{ fontSize: "13px" }}><b>{sub.id.toUpperCase()}.</b> {sub.content}</span>
                              <div style={{ display: "flex", gap: "12px" }}>
                                <label style={{ fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <input 
                                    type="radio" 
                                    name={`tf_${q.id}_${sub.id}`} 
                                    checked={answers[q.id]?.[sub.id] === true}
                                    onChange={() => setAnswers(prev => ({ ...prev, [q.id]: { ...(prev[q.id] || {}), [sub.id]: true } }))}
                                  /> Đúng
                                </label>
                                <label style={{ fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <input 
                                    type="radio" 
                                    name={`tf_${q.id}_${sub.id}`} 
                                    checked={answers[q.id]?.[sub.id] === false}
                                    onChange={() => setAnswers(prev => ({ ...prev, [q.id]: { ...(prev[q.id] || {}), [sub.id]: false } }))}
                                  /> Sai
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {q.section === "SHORT" && (
                        <input 
                          type="text" 
                          placeholder="Nhập câu trả lời ngắn của bạn..."
                          value={answers[q.id] || ""}
                          onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "6px" }}
                        />
                      )}

                      {q.section === "ESSAY" && (
                        <textarea 
                          rows={3}
                          placeholder="Trình bày bài làm tự luận của bạn..."
                          value={answers[q.id] || ""}
                          onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "6px" }}
                        />
                      )}
                    </div>
                  ))}

                  <button onClick={submitExam} style={{ background: "#0d9488", color: "#fff", border: "none", padding: "12px 20px", borderRadius: "8px", fontWeight: "700", cursor: "pointer", fontSize: "15px", marginTop: "10px" }}>
                    Nộp bài thi
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <h2 style={{ color: "#0f766e" }}>🎉 Hoàn thành bài thi!</h2>
              <p style={{ color: "#64748b" }}>Cảm ơn bạn đã hoàn thành bài kiểm tra Khoa học tự nhiên.</p>
              <div style={{ background: "#f0fdf4", border: "1px solid #5eead4", padding: "16px", borderRadius: "8px", display: "inline-block", marginTop: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: "700", color: "#0f766e" }}>Điểm trắc nghiệm tự động: {autoScore.toFixed(2)} điểm</span>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
