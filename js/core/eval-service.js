/* Evaluation storage: acknowledge writes, preserve attempts, and isolate local demonstrations. */
class EvalService {
  constructor() {
    this.channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ALGO_EVAL_DEMO_V2') : null;
    this.listeners = new Set();
    this.channel?.addEventListener('message', event => {
      const message = event.data;
      if (!message || !this.isDemo() || !/^2-(?:[1-9]|10|11)$/.test(message.classId)) return;
      if (message.type === 'snapshot-request') {
        this.channel.postMessage({ type: 'snapshot', classId: message.classId, session: this.read('EVAL_SESSION_' + message.classId, null), students: this.read('EVAL_STUDENTS_' + message.classId, []) });
        return;
      }
      if (message.session) this.write('EVAL_SESSION_' + message.classId, { ...this.read('EVAL_SESSION_' + message.classId, {}), ...message.session });
      if(message.replaceStudents)this.write('EVAL_STUDENTS_'+message.classId,[]);
      for (const student of message.students || []) this.mergeLocalStudent(message.classId, student);
      this.emit(message.classId);
    });
  }
  isDemo() { return window.authService?.isDemo() === true; }
  getDb() {
    if (this.isDemo()) return null;
    const db = window.firebaseDb || (typeof initFirebaseApp === 'function' && initFirebaseApp());
    if (!db) throw new Error('서버에 연결되지 않았습니다. 입력 내용을 유지한 채 다시 연결해 주세요.');
    return db;
  }
  read(key, fallback) { try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  write(key, value) { sessionStorage.setItem(key, JSON.stringify(value)); }
  identity(classId, num) {
    if (!/^2-(?:[1-9]|10|11)$/.test(classId) || !Number.isInteger(Number(num)) || Number(num) < 1 || Number(num) > 27) throw new Error('학급과 번호를 확인해 주세요.');
    return String(Number(num)).padStart(2, '0');
  }
  defaultSession(classId) { return { classId, questionVersion:2, status: 'waiting', durationMinutes: 30, startTime: null, maxStudents: 27 }; }
  mergeLocalStudent(classId, student) {
    const key = 'EVAL_STUDENTS_' + classId;
    const list = this.read(key, []);
    const index = list.findIndex(item => item.numStr === student.numStr);
    if (index < 0) list.push(student); else list[index] = { ...list[index], ...student };
    this.write(key, list);
  }
  emit(classId) { this.listeners.forEach(listener => { if (listener.classId === classId) listener.run(); }); }
  demoListen(classId, run) {
    const listener = { classId, run }; this.listeners.add(listener); run();
    this.channel?.postMessage({ type: 'snapshot-request', classId });
    return () => this.listeners.delete(listener);
  }
  notify(classId, data) {
    this.emit(classId);
    this.channel?.postMessage({ type: 'update', classId, ...data });
  }
  listenSession(classId, callback, onError = error => alert(error.message)) {
    const db = this.getDb();
    if (db) return db.collection('classrooms').doc(classId).onSnapshot(doc => callback(doc.exists ? doc.data() : this.defaultSession(classId)), onError);
    return this.demoListen(classId, () => callback(this.read('EVAL_SESSION_' + classId, this.defaultSession(classId))));
  }
  async startSession(classId, durationMinutes = 30) {
    await window.authService.teacher();
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) throw new Error('평가 시간을 확인해 주세요.');
    const now = Date.now();
    const payload = { ...this.defaultSession(classId), schemaVersion:2, status: 'in_progress', durationMinutes, startTime: new Date(now).toISOString(), deadlineMs: now + durationMinutes * 60000, endedAt: null };
    const db = this.getDb();
    if (db) {
      const ref=db.collection('classrooms').doc(classId);
      await db.runTransaction(async tx=>{
        const old=await tx.get(ref);
        if(!old.exists || old.data().status!=='waiting')throw Error('새 평가 준비를 먼저 눌러 주세요. 진행 중인 평가를 다시 시작할 수 없습니다.');
        payload.questionVersion=old.data().questionVersion||1;
        payload.attemptId=old.data().attemptId;tx.update(ref,payload);
      });
    } else {
      const old=this.read('EVAL_SESSION_'+classId,this.defaultSession(classId));
      if(old.status!=='waiting')throw Error('새 평가 준비를 먼저 눌러 주세요.');
      payload.questionVersion=old.questionVersion||1;
      payload.attemptId=old.attemptId||crypto.randomUUID();this.write('EVAL_SESSION_' + classId, payload); this.notify(classId, { session: payload });
    }
    return payload;
  }
  async prepareSession(classId) {
    await window.authService.teacher();this.identity(classId,1);
    const db=this.getDb(), archivedAt=new Date().toISOString(), archiveId=crypto.randomUUID();
    const fresh={...this.defaultSession(classId),schemaVersion:2,attemptId:crypto.randomUUID(),preparedAt:archivedAt};
    if(db){
      const ref=db.collection('classrooms').doc(classId);
      await db.runTransaction(async tx=>{
        const session=await tx.get(ref);
        if(session.exists && session.data().status==='in_progress')throw Error('진행 중인 평가를 먼저 마감해 주세요.');
        const seats=await Promise.all(Array.from({length:27},(_,i)=>tx.get(ref.collection('students').doc(this.identity(classId,i+1)))));
        const archive=ref.collection('archives').doc(archiveId);
        if(session.exists || seats.some(s=>s.exists))tx.set(archive,{kind:'new-session',archivedAt,session:session.exists?session.data():{}});
        seats.filter(s=>s.exists).forEach(s=>{tx.set(archive.collection('students').doc(s.id),s.data());tx.delete(s.ref);});
        tx.set(ref,fresh);
      });
    }else{
      const old=this.read('EVAL_SESSION_'+classId,{});
      if(old.status==='in_progress')throw Error('진행 중인 평가를 먼저 마감해 주세요.');
      this.write('EVAL_ARCHIVE_'+archiveId,{session:old,students:this.read('EVAL_STUDENTS_'+classId,[])});
      this.write('EVAL_STUDENTS_'+classId,[]);this.write('EVAL_SESSION_'+classId,fresh);this.notify(classId,{session:fresh,replaceStudents:true,students:[]});
    }
    return fresh;
  }
  async endSession(classId) {
    await window.authService.teacher();
    const payload = { status: 'ended', endedAt: new Date().toISOString() };
    const db = this.getDb();
    if (db) await db.collection('classrooms').doc(classId).update(payload);
    else {
      this.write('EVAL_SESSION_' + classId, { ...this.read('EVAL_SESSION_' + classId, {}), ...payload });
      this.notify(classId, { session: payload });
    }
  }
  async joinWaitingRoom(classId, studentNum, studentName) {
    const docId = this.identity(classId, studentNum);
    if (!studentName.trim() || studentName.length > 40) throw new Error('이름을 40자 이내로 입력해 주세요.');
    const user = await window.authService.student();
    const student = { num: Number(studentNum), numStr: docId, name: studentName.trim(), ownerUid: user.uid, status: 'waiting', joinedAt: new Date().toISOString(), submittedAt: null, progress: {part1:0,part2:0,part3:0}, answers: {part1:{},part2:{},part3:{questionVersion:2,blocks:[],connections:[]}}, feedback: {} };
    const db = this.getDb();
    if (db) {
      const ref = db.collection('classrooms').doc(classId).collection('students').doc(docId);
      return db.runTransaction(async transaction => {
        const existing = await transaction.get(ref);
        if (existing.exists) {
          if (existing.data().ownerUid !== user.uid) throw new Error('이 번호는 다른 응시 기록에 연결되어 있습니다. 선생님께 확인해 주세요.');
          return existing.data();
        }
        const session=await transaction.get(db.collection('classrooms').doc(classId));
        if(!session.exists || !['waiting','in_progress'].includes(session.data().status))throw Error('선생님께서 새 평가를 준비한 후 입장해 주세요.');
        student.attemptId=session.data().attemptId;
        student.answers.part3.questionVersion=session.data().questionVersion||1;
        transaction.set(ref, student);
        return student;
      });
    }
    const existing = this.read('EVAL_STUDENTS_' + classId, []).find(item => item.numStr === docId);
    if (existing) return existing;
    student.answers.part3.questionVersion=this.read('EVAL_SESSION_'+classId,this.defaultSession(classId)).questionVersion||1;
    this.mergeLocalStudent(classId, student); this.notify(classId, {students:[student]}); return student;
  }
  async updateStudentProgress(classId, studentNum, progress, answers) {
    const docId = this.identity(classId, studentNum);
    const payload = { status: 'in_progress', progress, updatedAt: new Date().toISOString() };
    if (answers) payload.answers = JSON.parse(JSON.stringify(answers));
    const db = this.getDb();
    if (db) await db.collection('classrooms').doc(classId).collection('students').doc(docId).update(payload);
    else {
      const student = { num: Number(studentNum), numStr: docId, ...payload };
      this.mergeLocalStudent(classId, student); this.notify(classId, { students: [student] });
    }
  }
  async submitStudentExam(classId, studentNum, fullSubmission) {
    const docId = this.identity(classId, studentNum);
    // Scores supplied by a student browser are never stored as authoritative grades.
    const finalData = { status: 'submitted', submittedAt: new Date().toISOString(), answers: JSON.parse(JSON.stringify(fullSubmission.answers)) };
    const db = this.getDb();
    if (db) {
      const ref=db.collection('classrooms').doc(classId).collection('students').doc(docId);
      return db.runTransaction(async transaction=>{
        const saved=await transaction.get(ref);
        if (!saved.exists) throw new Error('응시 기록이 없습니다. 선생님께 확인해 주세요.');
        const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
        if(saved.data().status==='submitted') {
          if(canonical(saved.data().answers)!==canonical(finalData.answers)) throw new Error('서버에 이미 다른 답안이 제출되어 있습니다. 선생님께 확인해 주세요.');
          return saved.data();
        }
        transaction.update(ref,finalData);
        return finalData;
      }).catch(error=>{throw new Error(error.code==='permission-denied'?'저장 권한 또는 마감 상태를 확인해 주세요. 답안은 이 창에 유지됩니다.':error.message);});
    }
    else {
      const student = { num: Number(studentNum), numStr: docId, ...finalData };
      this.mergeLocalStudent(classId, student); this.notify(classId, { students: [student] });
    }
    return finalData;
  }
  listenStudents(classId, callback, onError = error => alert(error.message)) {
    const grade = (students,version) => callback(students.sort((a,b)=>a.num-b.num).map(student => {
      // The teacher-controlled round selects the rubric, never a student-supplied version.
      const calculated = typeof gradeEvaluation === 'function' ? gradeEvaluation(student.answers || {},version) : { scores: {} };
      return {...student, scores:{...calculated.scores, teacherOverride:student.scores?.teacherOverride ?? null}, feedback:calculated.feedback || {}};
    }));
    const db = this.getDb();
    if (db) {
      let students=null,version=null;
      const stopSession=this.listenSession(classId,session=>{version=session.questionVersion||1;if(students)grade(students,version);},onError);
      const stopStudents=db.collection('classrooms').doc(classId).collection('students').onSnapshot(snapshot=>{
        students=[];snapshot.forEach(doc=>students.push(doc.data()));if(version!==null)grade(students,version);
      },onError);
      return ()=>{stopSession();stopStudents();};
    }
    return this.demoListen(classId, () => grade(this.read('EVAL_STUDENTS_' + classId, []),this.read('EVAL_SESSION_'+classId,this.defaultSession(classId)).questionVersion||1));
  }
  async overrideStudentScore(classId, studentNum, newScore) {
    await window.authService.teacher();
    const score=Number(newScore);
    if (!Number.isFinite(score) || score<0 || score>100 || String(newScore).trim()==='') throw new Error('점수는 0~100 사이 숫자로 입력해 주세요.');
    const docId=this.identity(classId,studentNum), db=this.getDb();
    if(db) await db.collection('classrooms').doc(classId).collection('students').doc(docId).update({'scores.teacherOverride':score});
    else {
      const student=this.read('EVAL_STUDENTS_'+classId,[]).find(item=>item.numStr===docId);
      if(!student) throw new Error('학생 기록이 없습니다.');
      student.scores={...student.scores,teacherOverride:score};this.mergeLocalStudent(classId,student);this.notify(classId,{students:[student]});
    }
    return true;
  }
  async resetStudentExam(classId, studentNum) {
    await window.authService.teacher();
    const docId=this.identity(classId,studentNum), db=this.getDb();
    const payload={status:'in_progress', submittedAt:null, answers:{part1:{},part2:{},part3:null}, scores:{teacherOverride:null}, progress:{part1:0,part2:0,part3:0}, resetAt:new Date().toISOString()};
    if(db) {
      const sessionRef=db.collection('classrooms').doc(classId),ref=sessionRef.collection('students').doc(docId);
      const archive=sessionRef.collection('archives').doc(crypto.randomUUID());
      await db.runTransaction(async tx=>{
        const session=await tx.get(sessionRef),student=await tx.get(ref);
        if(!student.exists)throw Error('응시 기록이 없습니다.');
        if(session.data()?.status!=='in_progress'||Date.now()>=session.data().deadlineMs)throw Error('평가 시간이 끝났습니다. 새 평가 준비를 사용해 주세요.');
        payload.answers.part3={questionVersion:student.data().answers?.part3?.questionVersion||1,blocks:[],connections:[]};
        tx.set(archive,{kind:'student-reset',archivedAt:payload.resetAt,session:session.data()});
        tx.set(archive.collection('students').doc(docId),student.data());tx.update(ref,payload);
      });
    }
    else { const old=this.read('EVAL_STUDENTS_'+classId,[]).find(s=>s.numStr===docId);payload.answers.part3={questionVersion:old?.answers?.part3?.questionVersion||1,blocks:[],connections:[]};const student={num:Number(studentNum),numStr:docId,...payload};this.mergeLocalStudent(classId,student);this.notify(classId,{students:[student]}); }
    return true;
  }
  listenStudent(classId, studentNum, callback, onError = error => alert(error.message)) {
    const docId=this.identity(classId,studentNum),db=this.getDb();
    if(db) return db.collection('classrooms').doc(classId).collection('students').doc(docId).onSnapshot(doc=>{if(doc.exists)callback(doc.data());},onError);
    return this.demoListen(classId,()=>{const student=this.read('EVAL_STUDENTS_'+classId,[]).find(item=>item.numStr===docId);if(student)callback(student);});
  }
  exportNeisCSV(classId, studentList=[]) {
    const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
    const rows=[['학급','번호','이름','응시상태','객관식/30','단답형/30','순서도/40','자동채점 총점','교사 조정','최종 점수','제출시각']];
    [...studentList].sort((a,b)=>a.num-b.num).forEach(student=>{
      const score=student.scores||{};
      rows.push([classId,student.num,student.name,student.status,score.part1||0,score.part2||0,score.part3||0,score.total||0,score.teacherOverride??'',score.teacherOverride??score.total??0,student.submittedAt||'']);
    });
    const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=classId+'_평가.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
window.evalService = new EvalService();
