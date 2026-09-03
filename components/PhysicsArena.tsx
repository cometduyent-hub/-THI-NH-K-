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

function shuffle<T>(arr:T[]) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

function scoreTF(answer:boolean[]|undefined, key:boolean[]|undefined, point:number) {
  if(!answer || !key) return 0;
  const wrong=answer.reduce((n,v,i)=>n+(v!==key[i]?1:0),0);
  const factor = [1,.5,.25,.1,0][wrong];
  return point*factor;
}

function parseRow(r:any): Question {
  const section = String(r.section||"MCQ").toUpperCase() as Section;
  const options = ["A","B","C","D"].map(k=>({key:k,text:String(r["option"+k]??"")})).filter(x=>x.text);
  const tf = ["tfA","tfB","tfC","tfD"].map(k=>String(r[k]).toLowerCase()==="true" || r[k]===true);
  return {
    id:String(r.id||crypto.randomUUID()), section, subject:String(r.subject||"Vật lí"), grade:String(r.grade||"8"),
    topic:String(r.topic||"Chưa phân loại"), difficulty:(String(r.difficulty||"TH").toUpperCase() as Difficulty),
    content:String(r.content||""), imageUrl:String(r.imageUrl||"")||undefined,
    options: options.length?options:undefined, correctOption:String(r.correctOption||"")||undefined,
    tf: section==="TF"?tf:undefined, shortAnswer:String(r.shortAnswer??"")||undefined,
    tolerance:Number(r.tolerance||0), points:Number(r.points||1)
  };
}

export default function PhysicsArena() {
  const [mode,setMode]=useState<"teacher"|"student">("teacher");
  const [tab,setTab]=useState<"bank"|"matrix"|"exam"|"grading"|"stats">("bank");
  const [questions,setQuestions]=useState<Question[]>(seed);
  const [matrix,setMatrix]=useState<Matrix>(defaultMatrix);
  const [exam,setExam]=useState<Question[]>([]);
  const [answers,setAnswers]=useState<Record<string,any>>({});
  const [current,setCurrent]=useState(0);
  const [submitted,setSubmitted]=useState(false);
  const [studentName,setStudentName]=useState("");
  const [minutes,setMinutes]=useState(45);
  const [seconds,setSeconds]=useState(45*60);
  const [imagePreview,setImagePreview]=useState<string>("");
  const [essayScores,setEssayScores]=useState<Record<string,number>>({});
  const [notice,setNotice]=useState("");

  const totalPoints = useMemo(()=>exam.reduce((s,q)=>s+q.points,0),[exam]);
  const autoScore = useMemo(()=>exam.reduce((s,q)=>{
    const a=answers[q.id];
    if(q.section==="MCQ") return s+(a===q.correctOption?q.points:0);
    if(q.section==="TF") return s+scoreTF(a,q.tf,q.points);
    if(q.section==="SHORT"){
      const n=Number(a); const key=Number(q.shortAnswer);
      return s+(Number.isFinite(n)&&Math.abs(n-key)<=Number(q.tolerance||0)?q.points:0);
    }
    return s;
  },0),[exam,answers]);
  const finalScore = autoScore + Object.values(essayScores).reduce((a,b)=>a+b,0);

  function generateExam() {
    const selected:Question[]=[];
    (Object.keys(matrix) as Section[]).forEach(sec=>{
      (Object.keys(matrix[sec]) as Difficulty[]).forEach(d=>{
        const n=matrix[sec][d];
        const pool=questions.filter(q=>q.section===sec && q.difficulty===d);
        selected.push(...shuffle(pool).slice(0,n));
      });
    });
    const randomized=shuffle(selected).map(q=>q.section==="MCQ" && q.options ? {...q, options:shuffle(q.options)} : q);
    setExam(randomized);
    setAnswers({});
    setEssayScores({});
    setCurrent(0);
    setSubmitted(false);
    setSeconds(minutes*60);
    setTab("exam");
    setNotice(`Đã tạo đề ${randomized.length} câu từ ngân hàng.`);
  }

  function updateMatrix(sec:Section,d:Difficulty,value:number) {
    setMatrix(m=>({...m,[sec]:{...m[sec],[d]:Math.max(0,Math.floor(value||0))}}));
  }

  function importFile(e:ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const data=ev.target?.result;
        let rows:any[]=[];
        if(file.name.endsWith(".json")) rows=JSON.parse(String(data));
        else {
          const wb=XLSX.read(data,{type:"array"});
          rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        }
        const parsed=rows.map(parseRow).filter(q=>q.content);
        setQuestions(parsed);
        setNotice(`Đã cập nhật ${parsed.length} câu hỏi từ ${file.name}.`);
      }catch(err){ setNotice("Không đọc được file. Hãy kiểm tra định dạng mẫu."); }
    };
    if(file.name.endsWith(".json")) reader.readAsText(file); else reader.readAsArrayBuffer(file);
  }

  function uploadImage(e:ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if(!file)return;
    const url=URL.createObjectURL(file);
    setImagePreview(url);
    setNotice("Đã nạp ảnh xem trước. Khi kết nối Storage Supabase, ảnh có thể được lưu dùng chung.");
  }

  function submitExam() {
    setSubmitted(true);
    setTab("grading");
    setNotice("Bài đã được nộp. Các phần tự động đã được chấm; phần tự luận chờ giáo viên chấm.");
  }

  return <main className="app-shell">
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
  <button className={mode==="student"?"active":""} onClick={()=>setMode("student")}>👨‍🎓 Học sinh</button>
</div>
    </header>

    {notice && <div className="notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}

    {mode==="teacher" ? <section className="workspace">
      <aside className="sidebar">
        <div className="side-title">BẢNG ĐIỀU KHIỂN</div>
        {[
          ["bank","📚","Ngân hàng câu hỏi"],
          ["matrix","🧩","Ma trận & tạo đề"],
          ["exam","📝","Xem đề"],
          ["grading","✍️","Chấm bài"],
          ["stats","📊","Thống kê"]
        ].map(([id,icon,label])=><button key={id} className={tab===id?"nav active":"nav"} onClick={()=>setTab(id as any)}><span>{icon}</span>{label}</button>)}
        <div className="sidebar-card"><b>4 PHẦN</b><small>Trắc nghiệm · Đúng/Sai · Trả lời ngắn · Tự luận</small></div>
      </aside>

      <div className="content">
        {tab==="bank" && <div className="panel">
          <div className="panel-head"><div><h1>📚 Ngân hàng câu hỏi</h1><p>Quản lý câu hỏi theo lớp, chủ đề và mức độ.</p></div>
          <label className="primary-btn">⬆ Cập nhật ngân hàng
            <input hidden type="file" accept=".xlsx,.csv,.json" onChange={importFile}/>
          </label></div>
          <div className="metrics"><Metric n={questions.length} t="Tổng câu"/><Metric n={questions.filter(q=>q.section==="MCQ").length} t="Nhiều lựa chọn"/><Metric n={questions.filter(q=>q.section==="TF").length} t="Đúng/Sai"/><Metric n={questions.filter(q=>q.section==="SHORT").length} t="Trả lời ngắn"/></div>
          <div className="toolbar"><span>Định dạng hỗ trợ: XLSX · CSV · JSON</span><a href="/question-bank-template.csv" download>Tải file mẫu</a></div>
          <div className="table-wrap"><table><thead><tr><th>Mã</th><th>Phần</th><th>Chủ đề</th><th>Mức độ</th><th>Nội dung</th><th>Điểm</th></tr></thead><tbody>
            {questions.map(q=><tr key={q.id}><td><b>{q.id}</b></td><td><Badge>{q.section}</Badge></td><td>{q.topic}</td><td>{diffLabel[q.difficulty]}</td><td>{q.content}</td><td>{q.points}</td></tr>)}
          </tbody></table></div>
          <div className="upload-box"><div><b>🖼 Hình ảnh câu hỏi</b><p>Nạp ảnh để xem trước trong trình soạn đề.</p></div><label className="secondary-btn">Chọn ảnh<input hidden type="file" accept="image/*" onChange={uploadImage}/></label>{imagePreview&&<img src={imagePreview} alt="preview"/>}</div>
        </div>}

        {tab==="matrix" && <div className="panel">
          <div className="panel-head"><div><h1>🧩 Ma trận & tạo đề</h1><p>Thay đổi số lượng câu theo từng phần và mức độ.</p></div><button className="primary-btn" onClick={generateExam}>🎲 Tạo đề ngẫu nhiên</button></div>
          <div className="matrix-table"><div className="matrix-row header"><span>Phần</span><span>Nhận biết</span><span>Thông hiểu</span><span>Vận dụng</span><span>Vận dụng cao</span></div>
          {(Object.keys(matrix) as Section[]).map(sec=><div className="matrix-row" key={sec}><strong>{sectionLabel[sec]}</strong>{(["NB","TH","VD","VDC"] as Difficulty[]).map(d=><input key={d} type="number" min="0" value={matrix[sec][d]} onChange={e=>updateMatrix(sec,d,Number(e.target.value))}/>)}</div>)}</div>
          <div className="rule-card"><h3>⚡ Quy tắc chấm Đúng/Sai</h3><div className="score-rules"><span>0 sai → <b>100%</b></span><span>1 sai → <b>50%</b></span><span>2 sai → <b>25%</b></span><span>3 sai → <b>10%</b></span><span>4 sai → <b>0%</b></span></div></div>
          <div className="settings-grid"><label>Thời gian (phút)<input type="number" min="1" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label><label>Lớp<select defaultValue="8"><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option></select></label><label>Tên bài kiểm tra<input defaultValue="Kiểm tra Vật lí"/></label></div>
        </div>}

        {tab==="exam" && <div className="panel">
          <div className="panel-head"><div><h1>📝 Đề hiện tại</h1><p>{exam.length} câu · xáo câu và xáo đáp án.</p></div><button className="secondary-btn" onClick={generateExam}>🔄 Tạo lại</button></div>
          {exam.length===0?<Empty text="Chưa có đề. Vào Ma trận & tạo đề để sinh đề."/>:<div className="question-list">{exam.map((q,i)=><div className="teacher-q" key={q.id}><div className="q-num">Câu {i+1}</div><div><Badge>{q.section}</Badge> <Badge>{diffLabel[q.difficulty]}</Badge><p>{q.content}</p>{q.imageUrl&&<img src={q.imageUrl} alt="question"/>}</div></div>)}</div>}
        </div>}

        {tab==="grading" && <div className="panel"><div className="panel-head"><div><h1>✍️ Chấm bài</h1><p>Điểm tự động + chấm tự luận thủ công.</p></div></div>
          {!exam.length?<Empty text="Chưa có bài thi."/>:<><div className="score-hero"><span>Điểm tự động <b>{autoScore.toFixed(2)}</b></span><span>Điểm tự luận <b>{Object.values(essayScores).reduce((a,b)=>a+b,0).toFixed(2)}</b></span><span>Tổng <b>{finalScore.toFixed(2)}</b></span></div>
          {exam.filter(q=>q.section==="ESSAY").map(q=><div className="essay-card" key={q.id}><h3>{q.id} · Tự luận · {q.points} điểm</h3><p>{q.content}</p><div className="student-answer">{answers[q.id]||"Chưa có bài làm."}</div><label>Điểm giáo viên<input type="number" min="0" max={q.points} step=".1" value={essayScores[q.id]??0} onChange={e=>setEssayScores(s=>({...s,[q.id]:Number(e.target.value)}))}/></label></div>)}</>}
        </div>}

        {tab==="stats" && <div className="panel"><div className="panel-head"><div><h1>📊 Thống kê</h1><p>Phân tích nhanh kết quả bài kiểm tra.</p></div></div>
          <div className="metrics"><Metric n={exam.length} t="Số câu"/><Metric n={autoScore.toFixed(2)} t="Điểm tự động"/><Metric n={finalScore.toFixed(2)} t="Điểm hiện tại"/><Metric n={submitted?"Đã nộp":"Chưa nộp"} t="Trạng thái"/></div>
          <div className="stat-card"><h3>Phân tích theo phần</h3>{(["MCQ","TF","SHORT","ESSAY"] as Section[]).map(s=><div className="bar-row" key={s}><span>{sectionLabel[s]}</span><div><i style={{width:`${exam.filter(q=>q.section===s).length?Math.min(100,(exam.filter(q=>q.section===s).length/exam.length)*100):0}%`}}/></div></div>)}</div>
        </div>}
      </div>
    </section> : <StudentView exam={exam} answers={answers} setAnswers={setAnswers} current={current} setCurrent={setCurrent} seconds={seconds} setSeconds={setSeconds} studentName={studentName} setStudentName={setStudentName} submitExam={submitExam} submitted={submitted} />}

    <footer>⚡ Physics Test Arena · Sẵn sàng triển khai GitHub → Vercel → Supabase</footer>
  </main>;
}

function StudentView({exam,answers,setAnswers,current,setCurrent,seconds,setSeconds,studentName,setStudentName,submitExam,submitted}:{exam:Question[],answers:Record<string,any>,setAnswers:any,current:number,setCurrent:any,seconds:number,setSeconds:any,studentName:string,setStudentName:any,submitExam:()=>void,submitted:boolean}) {
  const q=exam[current];
  const [started,setStarted]=useState(false);
  useMemo(()=>{ if(!started||submitted)return; const t=setInterval(()=>setSeconds((s:number)=>Math.max(0,s-1)),1000); return()=>clearInterval(t); },[started,submitted,setSeconds]);
  if(!started) return <div className="student-start"><div className="glow-orb">⚛</div><h1>PHYSICS TEST ARENA</h1><p>Phòng kiểm tra Vật lí trực tuyến</p><input placeholder="Họ và tên học sinh" value={studentName} onChange={e=>setStudentName(e.target.value)}/><button className="primary-btn" onClick={()=>setStarted(true)} disabled={!studentName.trim()}>BẮT ĐẦU LÀM BÀI</button><small>Đề sẽ được xáo ngẫu nhiên theo ma trận giáo viên.</small></div>;
  if(!exam.length) return <div className="student-start"><h1>Chưa có đề thi</h1><p>Giáo viên cần tạo đề trước.</p></div>;
  const mm=String(Math.floor(seconds/60)).padStart(2,"0"), ss=String(seconds%60).padStart(2,"0");
  return <div className="student-shell"><header className="student-top"><div><b>⚛ PHYSICS TEST ARENA</b><small>{studentName}</small></div><div className={`timer ${seconds<60?"danger":""}`}>⏱ {mm}:{ss}</div></header>
    <div className="student-body"><aside className="question-nav"><h3>Danh sách câu</h3>{exam.map((x,i)=><button key={x.id} className={`${i===current?"current ":""}${answers[x.id]!==undefined?"answered":""}`} onClick={()=>setCurrent(i)}>{i+1}</button>)}<div className="legend"><span>● Đã trả lời</span><span>○ Chưa trả lời</span></div></aside>
    <article className="question-card"><div className="q-meta"><Badge>{sectionLabel[q.section]}</Badge><span>Câu {current+1}/{exam.length}</span></div><h2>{q.content}</h2>{q.imageUrl&&<img className="question-image" src={q.imageUrl} alt="hình câu hỏi"/>}
      {q.section==="MCQ"&&q.options?.map(o=><label className={`option ${answers[q.id]===o.key?"selected":""}`} key={o.key}><input type="radio" name={q.id} checked={answers[q.id]===o.key} onChange={()=>setAnswers((a:any)=>({...a,[q.id]:o.key}))}/><b>{o.key}.</b>{o.text}</label>)}
      {q.section==="TF"&&<div className="tf-grid">{["a","b","c","d"].map((x,i)=><div className="tf-row" key={x}><span><b>{x})</b> Nhận định {x.toUpperCase()} của câu hỏi</span><button className={answers[q.id]?.[i]===true?"selected":""} onClick={()=>setAnswers((a:any)=>({...a,[q.id]:[...(a[q.id]||[undefined,undefined,undefined,undefined]).slice(0,i),true,...(a[q.id]||[]).slice(i+1)]}))}>Đúng</button><button className={answers[q.id]?.[i]===false?"selected":""} onClick={()=>setAnswers((a:any)=>({...a,[q.id]:[...(a[q.id]||[undefined,undefined,undefined,undefined]).slice(0,i),false,...(a[q.id]||[]).slice(i+1)]}))}>Sai</button></div>)}</div>}
      {q.section==="SHORT"&&<input className="short-input" placeholder="Nhập đáp án..." value={answers[q.id]??""} onChange={e=>setAnswers((a:any)=>({...a,[q.id]:e.target.value}))}/>}
      {q.section==="ESSAY"&&<textarea className="essay-input" placeholder="Trình bày bài làm..." value={answers[q.id]??""} onChange={e=>setAnswers((a:any)=>({...a,[q.id]:e.target.value}))}/>}
      <div className="nav-actions"><button onClick={()=>setCurrent(Math.max(0,current-1))} disabled={current===0}>← Câu trước</button><span>{current<exam.length-1?"Có thể quay lại sửa bài trước khi nộp":"Đã đến câu cuối"}</span>{current<exam.length-1?<button className="primary-btn" onClick={()=>setCurrent(current+1)}>Câu tiếp →</button>:<button className="submit-btn" onClick={submitExam}>NỘP BÀI</button>}</div>
    </article></div></div>;
}

function Metric({n,t}:{n:any,t:string}){return <div className="metric"><b>{n}</b><span>{t}</span></div>}
function Badge({children}:{children:React.ReactNode}){return <span className="badge">{children}</span>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}
