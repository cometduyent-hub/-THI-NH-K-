 "use client";

import { ChangeEvent, useMemo, useState } from "react";
import * as XLSX from "xlsx";

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
  imageUrl?: string;
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
  { id:"VL002", section:"MCQ", subject:"Vật lí", grade:"8", topic:"Chuyển động", difficulty:"TH", content:"Một vật đi được 120 m trong 20 s. Tốc độ trung bình của vật là", options:[{key:"A",text:"4 m/s"},{key:"B",text:"5 m/s"},{key:"C",text:"6 m/s"},{key:"D",text:"8 m/s"}], correctOption:"C", points:.25 },
  { id:"VL003", section:"TF", subject:"Vật lí", grade:"8", topic:"Lực", difficulty:"TH", content:"Xét các nhận định về lực tác dụng lên vật.", tf:[true,false,true,false], points:1 },
  { id:"VL004", section:"SHORT", subject:"Vật lí", grade:"8", topic:"Công suất", difficulty:"VD", content:"Một máy thực hiện công 600 J trong 20 s. Công suất của máy là bao nhiêu W?", shortAnswer:"30", tolerance:.1, points:.5 },
  { id:"VL005", section:"ESSAY", subject:"Vật lí", grade:"8", topic:"Áp suất", difficulty:"VD", content:"Giải thích vì sao giày cao gót có thể tạo áp suất lớn lên mặt sàn. Trình bày bằng kiến thức về áp suất.", points:2 },
  { id:"VL006", section:"MCQ", subject:"Vật lí", grade:"8", topic:"Áp suất", difficulty:"VD", content:"Áp suất phụ thuộc vào những đại lượng nào?", options:[{key:"A",text:"Lực tác dụng và diện tích bị ép"},{key:"B",text:"Khối lượng và thể tích"},{key:"C",text:"Thời gian và quãng đường"},{key:"D",text:"Nhiệt độ và khối lượng"}], correctOption:"A", points:.25 },
  { id:"VL007", section:"TF", subject:"Vật lí", grade:"8", topic:"Áp suất", difficulty:"VD", content:"Xét các phát biểu về áp suất chất lỏng.", tf:[true,true,false,true], points:1 },
  { id:"VL008", section:"SHORT", subject:"Vật lí", grade:"8", topic:"Áp suất", difficulty:"TH", content:"Áp suất của lực 200 N tác dụng lên diện tích 0,5 m² là bao nhiêu Pa?", shortAnswer:"400", tolerance:.1, points:.5 }
];

const defaultMatrix: Matrix = {
  MCQ: { NB:1, TH:1, VD:1, VDC:0 },
  TF: { NB:0, TH:1, VD:1, VDC:0 },
  SHORT: { NB:0, TH:1, VD:1, VDC:0 },
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
    imageUrl: String(r.imageUrl || "") || undefined,
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
  const [imagePreview, setImagePreview] = useState<string>("");
  const [essayScores, setEssayScores] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");

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
  
  const finalScore = autoScore + Object.values(essayScores).reduce((a, b) => a + b, 0);

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

  function uploadImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setNotice("Đã nạp ảnh xem trước. Khi kết nối Storage Supabase, ảnh có thể được lưu dùng chung.");
  }

  function submitExam() {
    setSubmitted(true);
    setTab("grading");
    setNotice("Bài đã được nộp. Các phần tự động đã được chấm; phần tự luận chờ giáo viên chấm.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="atom">⚛</span><div><b>PHYSICS TEST ARENA</b><small>Hệ thống kiểm tra online Vật lí</small></div></div>
        <div className="top-actions">
          {mode === "teacher" ? (
            <button onClick={() => setMode("student")}>🔓 Thoát quyền GV</button>
          ) : (
            <button onClick={() => {
              const pass = prompt("Nhập mật khẩu giáo viên:");
              if (pass === "123456") {
                setMode("teacher");
              } else if (pass !== null) {
                alert("Sai mật khẩu!");
              }
            }}>🔒 Giáo viên</button>
          )}
          <button className={mode === "student" ? "active" : ""} onClick={() => setMode("student")}>👨‍🎓 Học sinh</button>
        </div>
      </header>

      {notice && <div className="notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}

      {mode === "teacher" ? (
        <section className="workspace">
          <aside className="sidebar">
            <div className="side-title">BẢNG ĐIỀU KHIỂN</div>
            {[
              ["bank", "📚", "Ngân hàng câu hỏi"],
              ["matrix", "🧩", "Ma trận & tạo đề"],
              ["exam", "📝", "Xem đề"],
              ["grading", "✍️", "Chấm bài"],
              ["stats", "📊", "Thống kê"]
            ].map(([id, icon, label]) => (
              <button key={id} className={tab === id ? "nav active" : "nav"} onClick={() => setTab(id as any)}>
                <span>{icon}</span>{label}
              </button>
            ))}
            <div className="sidebar-card"><b>4 PHẦN</b><small>Trắc nghiệm · Đúng/Sai · Trả lời ngắn · Tự luận</small></div>
          </aside>

          <div className="content">
            {tab === "bank" && (
              <div className="panel">
                <div className="panel-head">
                  <div><h1>Ngân hàng câu hỏi</h1><p>Quản lý câu hỏi theo lớp, chủ đề và mức độ.</p></div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <label className="primary-btn">📥 Cập nhật ngân hàng
                      <input hidden type="file" accept=".xlsx,.csv,.json" onChange={importFile} />
                    </label>
                    <button className="secondary-btn" style={{ cursor: "pointer", background: "#2563eb", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "600" }} onClick={() => {
                      const newQ: Question = {
                        id: "Q_" + Date.now(),
                        section: "MCQ",
                        subject: "Khoa học tự nhiên",
                        grade: "7",
                        topic: "Chủ đề mới",
                        difficulty: "TH",
                        content: "Nhập nội dung câu hỏi mới tại đây...",
                        options: [
                          { key: "A", text: "Đáp án A" },
                          { key: "B", text: "Đáp án B" },
                          { key: "C", text: "Đáp án C" },
                          { key: "D", text: "Đáp án D" }
                        ],
                        correctOption: "A",
                        points: 0.25
                      };
                      setQuestions(prev => [newQ, ...prev]);
                    }}>➕ Thêm câu mới</button>
                  </div>
                </div>
                <div className="metrics">
                  <div className="metric"><b>{questions.length}</b><span>Tổng câu</span></div>
                  <div className="metric"><b>{questions.filter(q => q.section === "MCQ").length}</b><span>Nhiều lựa chọn</span></div>
                  <div className="metric"><b>{questions.filter(q => q.section === "TF").length}</b><span>Đúng / Sai</span></div>
                  <div className="metric"><b>{questions.filter(q => q.section === "SHORT").length}</b><span>Trả lời ngắn</span></div>
                  <div className="metric"><b>{questions.filter(q => q.section === "ESSAY").length}</b><span>Tự luận</span></div>
                </div>
                <div className="toolbar"><span>Định dạng hỗ trợ: XLSX - CSV - JSON</span><a href="/question-bank-template.csv" download>Tải file mẫu</a></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>ID</th><th>Phần</th><th>Chủ đề</th><th>Mức độ</th><th>Nội dung</th><th>Điểm</th><th>Hành động</th></tr></thead>
                    <tbody>
                      {questions.map((q, index) => (
                        <tr key={q.id || index}>
                          <td><b>{q.id}</b></td>
                          <td><span className="badge">{sectionLabel[q.section]}</span></td>
                          <td>{q.topic}</td>
                          <td>{diffLabel[q.difficulty]}</td>
                          <td>{q.content}</td>
                          <td>{q.points}</td>
                          <td>
                            <button style={{ background: "#fee2e2", color: "#991b1b", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }} onClick={() => { if (confirm("Xóa câu hỏi này?")) setQuestions(prev => prev.filter((_, i) => i !== index)); }}>🗑️ Xóa</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="upload-box">
                  <div><b>🖼 Hình ảnh câu hỏi</b><p>Nạp ảnh để xem trước trong trình soạn đề.</p></div>
                  <label className="secondary-btn">Chọn ảnh<input hidden type="file" accept="image/*" onChange={uploadImage} /></label>
                  {imagePreview && <img src={imagePreview} alt="preview" />}
                </div>
              </div>
            )}

            {tab === "matrix" && (
              <div className="panel">
                <div className="panel-head" style={{ flexWrap: "wrap", gap: "10px" }}>
                  <div><h1>🌿 Ma trận & tạo đề</h1><p>Thay đổi số lượng câu, tải lên hoặc lưu trữ ma trận và đề thi.</p></div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <label className="secondary-btn" style={{ cursor: "pointer", background: "#f1f5f9", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}>
                      📁 Tải lên ma trận
                      <input type="file" accept=".json" style={{ display: "none" }} onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          try {
                            const customMatrix = JSON.parse(String(event.target?.result));
                            if (customMatrix) {
                              setMatrix(customMatrix);
                              alert("Đã áp dụng mẫu ma trận tùy chỉnh thành công!");
                            }
                          } catch (err) {
                            alert("Lỗi đọc file ma trận!");
                          }
                        };
                        reader.readAsText(file);
                      }} />
                    </label>

                    <button className="secondary-btn" style={{ cursor: "pointer", background: "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(matrix, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", "ma_tran_de_thi.json");
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}>💾 Lưu ma trận</button>

                    <button className="secondary-btn" style={{ cursor: "pointer", background: "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} onClick={() => {
                      if (exam.length === 0) {
                        alert("Chưa có đề thi nào được tạo để lưu! Thầy hãy bấm 'Tạo đề thi' trước.");
                        return;
                      }
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exam, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", "de_thi_khoa_hoc_tu_nhien.json");
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}>💾 Lưu đề thi</button>

                    <button className="primary-btn" onClick={generateExam}>Tạo đề thi</button>
                  </div>
                </div>
                {(Object.keys(matrix) as Section[]).map(sec => (
                  <div className="matrix-row" key={sec}>
                    <strong>{sectionLabel[sec]}</strong>
                    {(["NB", "TH", "VD", "VDC"] as Difficulty[]).map(d => (
                      <input key={d} type="number" min="0" value={matrix[sec][d]} onChange={e => updateMatrix(sec, d, Number(e.target.value))} />
                    ))}
                  </div>
                ))}
                <div className="rule-card"><h3>⚡ Quy tắc chấm Đúng/Sai</h3><div className="score-rules"><span>0 sai → <b>100%</b></span><span>1 sai → <b>50%</b></span><span>2 sai → <b>25%</b></span><span>3 sai → <b>10%</b></span><span>4 sai → <b>0%</b></span></div></div>
                <div className="settings-grid">
                  <label>Thời gian (phút)<input type="number" min="1" value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label>
                  <label>Lớp<select defaultValue="8"><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option></select></label>
                  <label>Tên bài kiểm tra<input defaultValue="Kiểm tra Vật lí" /></label>
                </div>
              </div>
            )}

            {tab === "exam" && (
              <div className="panel">
                <div className="panel-head"><div><h1>📝 Đề hiện tại</h1><p>{exam.length} câu · xáo câu và xáo đáp án.</p></div><button className="secondary-btn" onClick={generateExam}>🔄 Tạo lại</button></div>
                {exam.length === 0 ? <div className="empty">Chưa có đề. Vào Ma trận & tạo đề để sinh đề.</div> : <div className="question-list">{exam.map((q, i) => <div className="teacher-q" key={q.id}><div className="q-num">Câu {i + 1}</div><div><span className="badge">{q.section}</span> <span className="badge">{diffLabel[q.difficulty]}</span><p>{q.content}</p>{q.imageUrl && <img src={q.imageUrl} alt="question" />}</div></div>)}</div>}
              </div>
            )}

            {tab === "grading" && (
              <div className="panel">
                <div className="panel-head"><div><h1>✍️ Chấm bài</h1><p>Điểm tự động + chấm tự luận thủ công.</p></div></div>
                {!exam.length ? <div className="empty">Chưa có bài thi.</div> : <>
                  <div className="score-hero"><span>Điểm tự động <b>{autoScore.toFixed(2)}</b></span><span>Điểm tự luận <b>{Object.values(essayScores).reduce((a, b) => a + b, 0).toFixed(2)}</b></span><span>Tổng <b>{finalScore.toFixed(2)}</b></span></div>
                  {exam.filter(q => q.section === "ESSAY").map(q => {
                    const studentAnswer = answers[q.id];
                    return (
                      <div className="essay-card" key={q.id} style={{ background: "#f8fafc", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0", marginTop: "12px" }}>
                        <h3 style={{ color: "#1e293b", fontSize: "15px", marginBottom: "6px" }}>{q.id} · Tự luận · {q.points || 1} điểm</h3>
                        <p style={{ fontWeight: "500", color: "#334155", marginBottom: "8px" }}>{q.content}</p>
                        <div className="student-answer" style={{ background: "#fff", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "10px" }}>
                          <p style={{ margin: "0 0 6px 0", fontSize: "14px" }}><b>Bài làm của học sinh:</b> {typeof studentAnswer === 'object' ? studentAnswer?.text : (studentAnswer || "Chưa làm")}</p>
                          {typeof studentAnswer === 'object' && studentAnswer?.file && (
                            <p style={{ fontSize: "13px", color: "#2563eb", margin: 0 }}>📁 File đính kèm: {studentAnswer.file}</p>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <label style={{ fontSize: "13px", fontWeight: "600", color: "#475569" }}>Nhập điểm:</label>
                          <input 
                            type="number" 
                            min="0" 
                            max={q.points || 1} 
                            step="0.25"
                            style={{ width: "90px", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "14px" }}
                            placeholder="0.0"
                            value={essayScores[q.id] ?? ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setEssayScores((prev: any) => ({ ...prev, [q.id]: val }));
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </>}
              </div>
            )}

            {tab === "stats" && (
              <div className="panel">
                <div className="panel-head" style={{ flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h1>📊 Thống kê & Báo cáo kết quả</h1>
                    <p>Phân tích tổng quan và xuất toàn bộ bài làm của học sinh ra file PDF.</p>
                  </div>
                  <div>
                    <button 
                      className="primary-btn" 
                      style={{ cursor: "pointer", background: "#0284c7", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "600" }}
                      onClick={() => { window.print(); }}
                    >
                      📥 Xuất báo cáo ra file PDF
                    </button>
                  </div>
                </div>

                <div className="metrics">
                  <div className="metric"><b>{exam.length}</b><span>Số câu</span></div>
                  <div className="metric"><b>{autoScore.toFixed(2)}</b><span>Điểm tự động</span></div>
                  <div className="metric"><b>{finalScore.toFixed(2)}</b><span>Điểm hiện tại</span></div>
                </div>

                <div className="stat-card" style={{ marginTop: "20px", background: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <h3 style={{ marginBottom: "10px", color: "#1e293b" }}>Chi tiết bài làm & Đáp án tự luận của học sinh</h3>
                  <div className="table-wrap">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                          <th style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Mã câu / Phần</th>
                          <th style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Nội dung câu hỏi</th>
                          <th style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Đáp án / Bài làm học sinh</th>
                          <th style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Điểm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exam.map((q, idx) => {
                          const ans = answers[q.id];
                          const isEssay = q.section === "ESSAY";
                          const essayScore = essayScores[q.id] || 0;
                          return (
                            <tr key={q.id || idx}>
                              <td style={{ padding: "8px", border: "1px solid #cbd5e1", fontWeight: "bold" }}>{q.id} ({q.section})</td>
                              <td style={{ padding: "8px", border: "1px solid #cbd5e1" }}>{q.content}</td>
                              <td style={{ padding: "8px", border: "1px solid #cbd5e1" }}>
                                {isEssay ? (
                                  <div>
                                    <div><b>Tự luận:</b> {typeof ans === 'object' ? ans?.text : (ans || "Chưa làm")}</div>
                                    {typeof ans === 'object' && ans?.file && <div style={{ color: "#2563eb", fontSize: "12px" }}>File: {ans.file}</div>}
                                  </div>
                                ) : (
                                  <span>{String(ans || "Chưa chọn")}</span>
                                )}
                              </td>
                              <td style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "bold" }}>
                                {isEssay ? `${essayScore} đ` : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <StudentView exam={exam} answers={answers} setAnswers={setAnswers} current={current} setCurrent={setCurrent} seconds={seconds} setSeconds={setSeconds} studentName={studentName} setStudentName={setStudentName} submitExam={submitExam} submitted={submitted} />
      )}

      <footer>⚡ Physics Test Arena · Sẵn sàng triển khai GitHub → Vercel → Supabase</footer>
    </main>
  );
}

function StudentView({ exam, answers, setAnswers, current, setCurrent, seconds, setSeconds, studentName, setStudentName, submitExam, submitted }: { exam: Question[], answers: Record<string, any>, setAnswers: any, current: number, setCurrent: any, seconds: number, setSeconds: any, studentName: string, setStudentName: any, submitExam: () => void, submitted: boolean }) {
  const q = exam[current];
  const [started, setStarted] = useState(false);
  
  useMemo(() => { 
    if (!started || submitted) return; 
    const t = setInterval(() => setSeconds((s: number) => Math.max(0, s - 1)), 1000); 
    return () => clearInterval(t); 
  }, [started, submitted, setSeconds]);

  if (!started) return (
    <div className="student-start" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: "20px", textAlign: "center" }}>
      <div className="glow-orb" style={{ fontSize: "48px", marginBottom: "15px" }}>⚛️</div>
      <h1 style={{ fontSize: "28px", color: "#1e293b", marginBottom: "10px" }}>CHINH PHỤC KHTN CÙNG THẦY TUẤN</h1>
      <p style={{ color: "#64748b", marginBottom: "25px", maxWidth: "500px" }}>Phòng kiểm tra trực tuyến tích hợp KaTeX và chấm bài tự động.</p>
      <div style={{ background: "#fff", padding: "25px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", width: "100%", maxWidth: "400px", display: "flex", flexDirection: "column", gap: "15px", textAlign: "left" }}>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "5px" }}>Họ và tên học sinh:</label>
          <input type="text" placeholder="Ví dụ: Nguyễn Văn A" value={studentName} onChange={e => setStudentName(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "5px" }}>Lớp:</label>
          <input type="text" placeholder="Ví dụ: 6/1" id="student-class-input" style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "5px" }}>Trường:</label>
          <input type="text" placeholder="Ví dụ: THCS..." id="student-school-input" style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px" }} />
        </div>
        <button className="primary-btn" style={{ width: "100%", padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontSize: "15px", fontWeight: "600", cursor: "pointer", marginTop: "5px" }} onClick={() => {
          if (!studentName.trim()) { alert("Vui lòng nhập họ tên!"); return; }
          const cls = (document.getElementById("student-class-input") as HTMLInputElement)?.value || "";
          const sch = (document.getElementById("student-school-input") as HTMLInputElement)?.value || "";
          if (cls || sch) setStudentName(`${studentName} (Lớp: ${cls} - Trường: ${sch})`);
          setStarted(true);
        }}>🚀 Bắt đầu làm bài</button>
      </div>
    </div>
  );

  if (!exam.length) return <div className="student-start"><h1>Chưa có đề thi</h1><p>Giáo viên cần tạo đề trước.</p></div>;
  
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0"), ss = String(seconds % 60).padStart(2, "0");
  
  return (
    <div className="student-shell">
      <header className="student-top">
        <div><b>PHYSICS TEST ARENA</b><small>({studentName})</small></div>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <div className={`timer ${seconds < 60 ? "danger" : ""}`}>{mm}:{ss}</div>
          <button className="primary-btn" style={{ background: "#16a34a", padding: "6px 14px", fontSize: "13px", cursor: "pointer", border: "none", borderRadius: "6px", color: "#fff" }} onClick={() => {
            if (confirm("Bạn có chắc chắn muốn nộp bài?")) submitExam();
          }}>Nộp bài</button>
        </div>
      </header>
      
      <div className="student-body">
        <aside className="student-nav">
          <h3>Danh sách câu hỏi</h3>
          {exam.map((x, i) => (
            <button key={x.id} className={`${i === current ? "current" : ""} ${answers[x.id] !== undefined && answers[x.id] !== "" ? "answered" : ""}`} onClick={() => setCurrent(i)}>{i + 1}</button>
          ))}
        </aside>
        
        <article className="question-card">
          <div className="question-meta"><span className="badge">{sectionLabel[q.section]}</span><span>Câu {current + 1}/{exam.length}</span></div>
          <h2>{q.content}</h2>
          {q.imageUrl && <img className="question-img" src={q.imageUrl} alt="minh họa" />}
          
          {/* Trắc nghiệm MCQ */}
          {q.section === "MCQ" && q.options?.map(o => (
            <label className={`option ${answers[q.id] === o.key ? "selected" : ""}`} key={o.key}>
              <input type="radio" name={q.id} checked={answers[q.id] === o.key} onChange={() => setAnswers((a: any) => ({ ...a, [q.id]: o.key }))} />
              <span><b>{o.key}.</b> {o.text}</span>
            </label>
          ))}
          
          {/* Đúng / Sai TF */}
          {q.section === "TF" && (
            <div className="tf-grid">
              {["a", "b", "c", "d"].map((x, i) => (
                <div className="tf-row" key={x}>
                  <span><b>{x})</b> {q.options?.[i]?.text || q.tfOptions?.[i]?.text || `Nhận định ${x.toUpperCase()} của câu hỏi`}</span>
                  <button className={answers[q.id]?.[i] === true ? "selected" : ""} onClick={() => setAnswers((a: any) => ({ ...a, [q.id]: [...(a[q.id] || [undefined, undefined, undefined, undefined]).slice(0, i), true, ...(a[q.id] || []).slice(i + 1)] }))}>Đúng</button>
                  <button className={answers[q.id]?.[i] === false ? "selected" : ""} onClick={() => setAnswers((a: any) => ({ ...a, [q.id]: [...(a[q.id] || [undefined, undefined, undefined, undefined]).slice(0, i), false, ...(a[q.id] || []).slice(i + 1)] }))}>Sai</button>
                </div>
              ))}
            </div>
          )}
          
          {/* Trả lời ngắn SHORT */}
          {q.section === "SHORT" && (
            <input className="short-input" placeholder="Nhập đáp án..." value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a: any) => ({ ...a, [q.id]: e.target.value }))} />
          )}
          
          {/* Tự luận ESSAY có kèm nút tải file */}
          {q.section === "ESSAY" && (
            <div className="essay-container">
              <div style={{ display: "flex", gap: "5px", marginBottom: "6px", flexWrap: "wrap", background: "#f8fafc", padding: "6px", border: "1px solid #e2e8f0", borderRadius: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#64748b", alignSelf: "center", marginRight: "5px" }}>Chèn nhanh:</span>
                {[
                  { label: "x²", insert: "^{2}" },
                  { label: "x₁", insert: "_{1}" },
                  { label: "a/b", insert: "\\frac{a}{b}" },
                  { label: "√x", insert: "\\sqrt{x}" },
                  { label: "α", insert: "\\alpha" },
                  { label: "β", insert: "\\beta" },
                  { label: "Δ", insert: "\\Delta" },
                  { label: "°C", insert: "^\\circ\\text{C}" },
                  { label: "Ω", insert: "\\Omega" },
                ].map((btn, idx) => (
                  <button 
                    key={idx}
                    type="button"
                    style={{ padding: "2px 8px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "3px", cursor: "pointer", fontSize: "13px" }}
                    onClick={() => {
                      const textarea = document.getElementById(`essay-textarea-${q.id}`) as HTMLTextAreaElement;
                      if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const val = textarea.value;
                        const newVal = val.substring(0, start) + btn.insert + val.substring(end);
                        
                        setAnswers((prev: any) => ({
                          ...prev,
                          [q.id]: typeof prev[q.id] === 'object' && prev[q.id] !== null 
                            ? { ...prev[q.id], text: newVal } 
                            : { text: newVal, file: null }
                        }));
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + btn.insert.length, start + btn.insert.length);
                        }, 0);
                      }
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <textarea 
                id={`essay-textarea-${q.id}`}
                className="essay-input"
                rows={6}
                placeholder="Nhập bài làm tự luận chi tiết..."
                value={typeof answers[q.id] === 'object' ? answers[q.id]?.text : (answers[q.id] || "")}
                onChange={(e) => {
                  const val = e.target.value;
                  setAnswers((prev: any) => ({
                    ...prev,
                    [q.id]: typeof prev[q.id] === 'object' && prev[q.id] !== null 
                      ? { ...prev[q.id], text: val } 
                      : { text: val, file: null }
                  }));
                }}
                style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", fontFamily: "inherit" }}
              />
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                <label className="secondary-btn" style={{ cursor: "pointer", fontSize: "13px", padding: "6px 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px" }}>
                  📁 Tải file/ảnh bài làm lên
                  <input type="file" style={{ display: "none" }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAnswers((prev: any) => ({
                        ...prev,
                        [q.id]: typeof prev[q.id] === 'object' && prev[q.id] !== null 
                          ? { ...prev[q.id], file: file.name } 
                          : { text: "", file: file.name }
                      }));
                    }
                  }} />
                </label>
                {typeof answers[q.id] === 'object' && answers[q.id]?.file && (
                  <span style={{ fontSize: "13px", color: "#2563eb" }}>Đã đính kèm: {answers[q.id].file}</span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
            <button className="secondary-btn" disabled={current === 0} onClick={() => setCurrent((c: number) => Math.max(0, c - 1))}>⬅️ Câu trước</button>
            <button className="primary-btn" disabled={current === exam.length - 1} onClick={() => setCurrent((c: number) => Math.min(exam.length - 1, c + 1))}>Câu tiếp theo ➡</button>
          </div>
        </article>
      </div>
    </div>
  );
}
