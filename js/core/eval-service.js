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
  defaultSession(classId) { return { classId, questionVersion:4, status: 'ended', durationMinutes: 30, startTime: null, maxStudents: 27 }; }
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
  async getSession(classId) {
    const db = this.getDb();
    if (db) {
      const doc = await db.collection('classrooms').doc(classId).get();
      return doc.exists ? doc.data() : this.defaultSession(classId);
    }
    return this.read('EVAL_SESSION_' + classId, this.defaultSession(classId));
  }
  listenSession(classId, callback, onError = error => alert(error.message)) {
    const db = this.getDb();
    if (db) return db.collection('classrooms').doc(classId).onSnapshot({includeMetadataChanges:true}, doc => callback(doc.exists ? doc.data() : this.defaultSession(classId), doc.metadata), onError);
    return this.demoListen(classId, () => callback(this.read('EVAL_SESSION_' + classId, this.defaultSession(classId))));
  }
  checkSessionExpectation(session, expected) {
    if (expected && ((session?.attemptId ?? null) !== expected.attemptId || (session?.status ?? 'ended') !== expected.status)) throw Error('다른 화면에서 평가 상태가 변경되었습니다. 현재 상태를 확인한 뒤 다시 눌러 주세요.');
  }
  async startSession(classId, durationMinutes = 30, expected) {
    await window.authService.teacher({classId});
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) throw new Error('평가 시간을 확인해 주세요.');
    const now = Date.now();
    const payload = { ...this.defaultSession(classId), schemaVersion:2, status: 'in_progress', durationMinutes, startTime: new Date(now).toISOString(), deadlineMs: now + durationMinutes * 60000, endedAt: null };
    const db = this.getDb();
    if (db) {
      const ref=db.collection('classrooms').doc(classId);
      await db.runTransaction(async tx=>{
        const old=await tx.get(ref);
        this.checkSessionExpectation(old.exists?old.data():null, expected);
        if(!old.exists || old.data().status!=='waiting')throw Error('새 평가 준비를 먼저 눌러 주세요. 진행 중인 평가를 다시 시작할 수 없습니다.');
        payload.questionVersion=old.data().questionVersion||1;
        payload.attemptId=old.data().attemptId;tx.update(ref,payload);
      });
    } else {
      const old=this.read('EVAL_SESSION_'+classId,this.defaultSession(classId));
      this.checkSessionExpectation(old, expected);
      if(old.status!=='waiting')throw Error('새 평가 준비를 먼저 눌러 주세요.');
      payload.questionVersion=old.questionVersion||1;
      payload.attemptId=old.attemptId||crypto.randomUUID();this.write('EVAL_SESSION_' + classId, payload); this.notify(classId, { session: payload });
    }
    return payload;
  }
  async prepareSession(classId, expected, questionVersion = 4) {
    await window.authService.teacher({classId});this.identity(classId,1);
    const db=this.getDb(), archivedAt=new Date().toISOString(), archiveId=crypto.randomUUID();
    const qv = (questionVersion === 3 || questionVersion === 4) ? questionVersion : 4;
    const fresh={...this.defaultSession(classId),questionVersion:qv,schemaVersion:2,status:'waiting',attemptId:crypto.randomUUID(),preparedAt:archivedAt};
    if(db){
      const ref=db.collection('classrooms').doc(classId);
      await db.runTransaction(async tx=>{
        const session=await tx.get(ref);
        this.checkSessionExpectation(session.exists?session.data():null, expected);
        if(session.exists && session.data().status==='in_progress')throw Error('진행 중인 평가를 먼저 마감해 주세요.');
        const seats=await Promise.all(Array.from({length:27},(_,i)=>tx.get(ref.collection('students').doc(this.identity(classId,i+1)))));
        const archive=ref.collection('archives').doc(archiveId);
        if(session.exists || seats.some(s=>s.exists))tx.set(archive,{kind:'new-session',archivedAt,session:session.exists?session.data():{}});
        seats.filter(s=>s.exists).forEach(s=>{tx.set(archive.collection('students').doc(s.id),s.data());tx.delete(s.ref);});
        tx.set(ref,fresh);
      });
    }else{
      const old=this.read('EVAL_SESSION_'+classId,{});
      this.checkSessionExpectation(old, expected);
      if(old.status==='in_progress')throw Error('진행 중인 평가를 먼저 마감해 주세요.');
      this.write('EVAL_ARCHIVE_'+archiveId,{session:old,students:this.read('EVAL_STUDENTS_'+classId,[])});
      this.write('EVAL_STUDENTS_'+classId,[]);this.write('EVAL_SESSION_'+classId,fresh);this.notify(classId,{session:fresh,replaceStudents:true,students:[]});
    }
    return fresh;
  }
  async endSession(classId, expected) {
    await window.authService.teacher({classId});
    const payload = { status: 'ended', endedAt: new Date().toISOString() };
    const db = this.getDb();
    if (db) {
      const ref=db.collection('classrooms').doc(classId);
      await db.runTransaction(async tx=>{
        const old=await tx.get(ref);
        this.checkSessionExpectation(old.exists?old.data():null, expected);
        if(!old.exists || !['in_progress','waiting'].includes(old.data().status))throw Error('진행 중이거나 대기 중인 평가만 종료할 수 있습니다.');
        tx.update(ref,payload);
      });
    }
    else {
      const old=this.read('EVAL_SESSION_' + classId, {});
      this.checkSessionExpectation(old, expected);
      if(!['in_progress','waiting'].includes(old.status))throw Error('진행 중이거나 대기 중인 평가만 종료할 수 있습니다.');
      this.write('EVAL_SESSION_' + classId, { ...old, ...payload });
      this.notify(classId, { session: payload });
    }
    return payload;
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
        const session=await transaction.get(db.collection('classrooms').doc(classId));
        const sessionData = session.exists ? session.data() : null;
        const assignFn = typeof assignQuestions === 'function' ? assignQuestions : (typeof window !== 'undefined' ? window.assignQuestions : null);
        if (existing.exists) {
          const existingData = existing.data();
          const canReconnect = existingData.allowReconnect === true;
          const isMakeup = existingData.makeupAllowed === true;

          if (existingData.ownerUid !== user.uid) {
            if (canReconnect || (isMakeup && !existingData.ownerUid)) {
              const updatePayload = {
                ownerUid: user.uid,
                allowReconnect: false,
                name: studentName.trim() || existingData.name || '',
                updatedAt: new Date().toISOString()
              };
              existingData.ownerUid = user.uid;
              existingData.allowReconnect = false;
              if (studentName.trim()) existingData.name = studentName.trim();
              transaction.update(ref, updatePayload);
            } else {
              throw new Error('이 번호는 다른 응시 기록에 연결되어 있습니다. 선생님께 확인해 주세요.');
            }
          }
          if (sessionData && [3, 4].includes(sessionData.questionVersion) && assignFn && !existingData.answers?.assignedQuestions) {
            existingData.answers = existingData.answers || {};
            existingData.answers.assignedQuestions = assignFn(`${existingData.attemptId || sessionData.attemptId}_${classId}_${studentNum}`);
            transaction.update(ref, { 'answers.assignedQuestions': existingData.answers.assignedQuestions });
          }
          return existingData;
        }
        if(!sessionData || !['waiting','in_progress'].includes(sessionData.status) || !sessionData.attemptId) {
          throw Error(`현재 ${classId}반은 수행평가가 열려 있지 않습니다. 선생님께서 대기실을 연 후 입장해 주세요.`);
        }
        student.attemptId=sessionData.attemptId;
        student.answers.part3.questionVersion=sessionData.questionVersion||1;
        if ([3, 4].includes(sessionData.questionVersion) && assignFn && !student.answers.assignedQuestions) {
          student.answers.assignedQuestions = assignFn(`${student.attemptId}_${classId}_${studentNum}`);
        }
        transaction.set(ref, student);
        return student;
      }).catch(error => {
        if (error.code === 'permission-denied') throw new Error('권한 오류: 이전 세션이 꼬였거나(새로고침 요망), 해당 번호를 이미 다른 기기에서 사용 중입니다.');
        throw error;
      });

    }
    const existing = this.read('EVAL_STUDENTS_' + classId, []).find(item => item.numStr === docId);
    if (existing) {
      const user = await window.authService.student();
      const canReconnect = existing.allowReconnect === true;
      const isMakeup = existing.makeupAllowed === true;
      if (existing.ownerUid && existing.ownerUid !== user.uid) {
        if (canReconnect || (isMakeup && !existing.ownerUid)) {
          existing.ownerUid = user.uid;
          existing.allowReconnect = false;
          if (studentName.trim()) existing.name = studentName.trim();
          this.mergeLocalStudent(classId, existing);
          this.notify(classId, { students: [existing] });
        } else {
          throw new Error('이 번호는 다른 응시 기록에 연결되어 있습니다. 선생님께 확인해 주세요.');
        }
      } else if (!existing.ownerUid) {
        existing.ownerUid = user.uid;
        if (studentName.trim()) existing.name = studentName.trim();
        this.mergeLocalStudent(classId, existing);
        this.notify(classId, { students: [existing] });
      }
      const session=this.read('EVAL_SESSION_'+classId,this.defaultSession(classId));
      const assignFn = typeof assignQuestions === 'function' ? assignQuestions : (typeof window !== 'undefined' ? window.assignQuestions : null);
      if (session && [3, 4].includes(session.questionVersion) && assignFn && !existing.answers?.assignedQuestions) {
        existing.answers = existing.answers || {};
        existing.answers.assignedQuestions = assignFn(`${existing.attemptId || session.attemptId}_${classId}_${studentNum}`);
        this.mergeLocalStudent(classId, existing);
      }
      return existing;
    }
    const session=this.read('EVAL_SESSION_'+classId,this.defaultSession(classId));
    if(!['waiting','in_progress'].includes(session?.status) || !session?.attemptId) {
      throw Error(`현재 ${classId}반은 수행평가가 열려 있지 않습니다. 선생님께서 대기실을 연 후 입장해 주세요.`);
    }
    student.answers.part3.questionVersion=session.questionVersion||1;student.attemptId=session.attemptId||'';
    const assignFn = typeof assignQuestions === 'function' ? assignQuestions : (typeof window !== 'undefined' ? window.assignQuestions : null);
    if ([3, 4].includes(session.questionVersion) && assignFn && !student.answers.assignedQuestions) {
      student.answers.assignedQuestions = assignFn(`${student.attemptId}_${classId}_${studentNum}`);
    }
    this.mergeLocalStudent(classId, student); this.notify(classId, {students:[student]}); return student;
  }
  async leaveWaitingRoom(classId, studentNum) {
    const docId = this.identity(classId, studentNum);
    const user = await window.authService.student();
    const db = this.getDb();
    if (db) {
      const ref = db.collection('classrooms').doc(classId).collection('students').doc(docId);
      await db.runTransaction(async tx => {
        const doc = await tx.get(ref);
        if (!doc.exists) return;
        if (doc.data().ownerUid !== user.uid) throw new Error('본인의 대기 기록만 취소할 수 있습니다.');
        if (doc.data().status !== 'waiting') throw new Error('평가가 이미 시작되었거나 제출된 상태에서는 대기실을 나갈 수 없습니다.');
        tx.delete(ref);
      }).catch(error => {
        if (error.code === 'permission-denied') throw new Error('대기실 퇴장 권한 오류: 이미 세션이 시작되었거나 변경되었습니다.');
        throw error;
      });
      return;
    }
    const key = 'EVAL_STUDENTS_' + classId;
    const list = this.read(key, []).filter(item => item.numStr !== docId);
    this.write(key, list);
    this.notify(classId, { replaceStudents: true, students: list });
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
    const finalData = { status: 'submitted', submittedAt: new Date().toISOString(), answers: JSON.parse(JSON.stringify(fullSubmission.answers || {})) };
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
      const calculated = version === 4
        ? {scores:{part1:null,part2:null,part3:null,objectiveTotal:null,total:null,teacherOverride:student.scores?.teacherOverride ?? null,pendingReview:true,serverGraded:true},feedback:{part1:'서버 채점 대기',part2:'서버 채점 대기',part3:'교사 검토 대기'}}
        : (typeof gradeEvaluation === 'function' ? gradeEvaluation(student.answers || {},version) : { scores: {} });
      if(version===3){
        calculated.scores=applyConfirmedAssessmentReview(calculated.scores,student);
      }
      return {...student, questionVersion:version,scores:{...calculated.scores, teacherOverride:[3,4].includes(version)?null:student.scores?.teacherOverride ?? null}, feedback:calculated.feedback || {}};
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
    await window.authService.teacher({classId});
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
    await window.authService.teacher({classId});
    const docId=this.identity(classId,studentNum), db=this.getDb();
    const payload={status:'in_progress', submittedAt:null, answers:{part1:{},part2:{},part3:null}, scores:{teacherOverride:null},review:null, progress:{part1:0,part2:0,part3:0}, resetAt:new Date().toISOString()};
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
  async clearStudentSeat(classId, studentNum) {
    await window.authService.teacher({classId});
    const docId = this.identity(classId, studentNum), db = this.getDb();
    if (db) {
      const ref = db.collection('classrooms').doc(classId).collection('students').doc(docId);
      await ref.delete();
    } else {
      const key = 'EVAL_STUDENTS_' + classId;
      const list = this.read(key, []).filter(item => item.numStr !== docId);
      this.write(key, list);
      this.notify(classId, { replaceStudents: true, students: list });
    }
    return true;
  }
  async forceSubmitStudentExam(classId, studentNum) {
    await window.authService.teacher({classId});
    const docId = this.identity(classId, studentNum), db = this.getDb();
    const finalData = { status: 'submitted', submittedAt: new Date().toISOString(), submittedBy: 'teacher_force' };
    if (db) {
      const ref = db.collection('classrooms').doc(classId).collection('students').doc(docId);
      return db.runTransaction(async tx => {
        const doc = await tx.get(ref);
        if (!doc.exists) throw new Error('응시 기록이 없습니다.');
        const current = doc.data();
        if (current.status === 'submitted') return current;
        tx.update(ref, finalData);
        return { ...current, ...finalData };
      });
    } else {
      const key = 'EVAL_STUDENTS_' + classId;
      const list = this.read(key, []);
      const student = list.find(item => item.numStr === docId);
      if (!student) throw new Error('응시 기록이 없습니다.');
      Object.assign(student, finalData);
      this.write(key, list);
      this.notify(classId, { replaceStudents: true, students: list });
      return student;
    }
  }
  async allowStudentReconnect(classId, studentNum) {
    await window.authService.teacher({classId});
    const docId = this.identity(classId, studentNum), db = this.getDb();
    const payload = { allowReconnect: true, reconnectAllowedAt: new Date().toISOString() };
    if (db) {
      const ref = db.collection('classrooms').doc(classId).collection('students').doc(docId);
      await ref.update(payload);
    } else {
      const key = 'EVAL_STUDENTS_' + classId;
      const list = this.read(key, []);
      const item = list.find(s => s.numStr === docId);
      if (!item) throw new Error('응시 기록이 없습니다.');
      item.allowReconnect = true;
      item.reconnectAllowedAt = payload.reconnectAllowedAt;
      this.write(key, list);
      this.notify(classId, { students: [item] });
    }
    return true;
  }
  async allowStudentMakeup(classId, studentNum, durationMinutes = 30) {
    await window.authService.teacher({classId});
    const docId = this.identity(classId, studentNum), db = this.getDb();
    const now = new Date().toISOString();
    if (db) {
      const sessionRef = db.collection('classrooms').doc(classId);
      const ref = sessionRef.collection('students').doc(docId);
      await db.runTransaction(async tx => {
        const session = await tx.get(sessionRef);
        if (!session.exists) throw new Error('학급 세션 정보를 찾을 수 없습니다.');
        const sessionData = session.data();
        const existing = await tx.get(ref);
        if (existing.exists && existing.data().status === 'submitted') {
          throw new Error('이미 정상 제출된 학생입니다. 재응시가 필요한 경우 재시험 기능을 이용해 주세요.');
        }
        const assignFn = typeof assignQuestions === 'function' ? assignQuestions : (typeof window !== 'undefined' ? window.assignQuestions : null);
        const studentAttemptId = sessionData.attemptId || crypto.randomUUID();
        const assigned = ([3, 4].includes(sessionData.questionVersion) && assignFn)
          ? assignFn(`${studentAttemptId}_${classId}_${studentNum}`)
          : null;
        const studentPayload = {
          num: Number(studentNum),
          numStr: docId,
          name: existing.exists ? (existing.data().name || '') : '',
          ownerUid: null,
          status: 'waiting',
          makeupAllowed: true,
          makeupDurationMinutes: durationMinutes,
          attemptId: studentAttemptId,
          joinedAt: now,
          submittedAt: null,
          progress: { part1: 0, part2: 0, part3: 0 },
          answers: {
            part1: {},
            part2: {},
            part3: { questionVersion: sessionData.questionVersion || 4, blocks: [], connections: [] },
            ...(assigned ? { assignedQuestions: assigned } : {})
          },
          feedback: {}
        };
        tx.set(ref, studentPayload);
      });
    } else {
      const session = this.read('EVAL_SESSION_' + classId, this.defaultSession(classId));
      const key = 'EVAL_STUDENTS_' + classId;
      const list = this.read(key, []);
      const existing = list.find(s => s.numStr === docId);
      if (existing && existing.status === 'submitted') {
        throw new Error('이미 정상 제출된 학생입니다. 재응시가 필요한 경우 재시험 기능을 이용해 주세요.');
      }
      const assignFn = typeof assignQuestions === 'function' ? assignQuestions : (typeof window !== 'undefined' ? window.assignQuestions : null);
      const assigned = ([3, 4].includes(session.questionVersion) && assignFn)
        ? assignFn(`${session.attemptId}_${classId}_${studentNum}`)
        : null;
      const studentPayload = {
        num: Number(studentNum),
        numStr: docId,
        name: existing?.name || '',
        ownerUid: null,
        status: 'waiting',
        makeupAllowed: true,
        makeupDurationMinutes: durationMinutes,
        attemptId: session.attemptId || 'demo',
        joinedAt: now,
        submittedAt: null,
        progress: { part1: 0, part2: 0, part3: 0 },
        answers: {
          part1: {},
          part2: {},
          part3: { questionVersion: session.questionVersion || 4, blocks: [], connections: [] },
          ...(assigned ? { assignedQuestions: assigned } : {})
        },
        feedback: {}
      };
      this.mergeLocalStudent(classId, studentPayload);
      this.notify(classId, { students: [studentPayload] });
    }
    return true;
  }
  async startStudentMakeupExam(classId, studentNum, durationMinutes = 30) {
    const docId = this.identity(classId, studentNum);
    const user = await window.authService.student();
    const db = this.getDb();
    const now = Date.now();
    const deadlineMs = now + durationMinutes * 60000;
    const payload = {
      status: 'in_progress',
      startedAt: new Date(now).toISOString(),
      deadlineMs: deadlineMs
    };
    if (db) {
      const ref = db.collection('classrooms').doc(classId).collection('students').doc(docId);
      await db.runTransaction(async tx => {
        const doc = await tx.get(ref);
        if (!doc.exists) throw new Error('학생 응시 기록을 찾을 수 없습니다.');
        if (doc.data().ownerUid !== user.uid) throw new Error('본인의 평가만 시작할 수 있습니다.');
        if (!doc.data().makeupAllowed) throw new Error('추가 응시 대상자가 아닙니다.');
        tx.update(ref, payload);
      });
    } else {
      const key = 'EVAL_STUDENTS_' + classId;
      const list = this.read(key, []);
      const item = list.find(s => s.numStr === docId);
      if (!item) throw new Error('학생 응시 기록을 찾을 수 없습니다.');
      Object.assign(item, payload);
      this.mergeLocalStudent(classId, item);
      this.notify(classId, { students: [item] });
    }
    return { deadlineMs, durationMinutes };
  }
  async autoSubmitRemainingStudents(classId) {
    await window.authService.teacher({classId});
    const db = this.getDb();
    const submittedAt = new Date().toISOString();
    const finalPatch = { status: 'submitted', submittedAt, submittedBy: 'teacher_auto_end' };
    let count = 0;
    if (db) {
      const colRef = db.collection('classrooms').doc(classId).collection('students');
      const snap = await colRef.get();
      const unsubmittedDocs = [];
      snap.forEach(doc => {
        if (doc.data().status !== 'submitted' && !doc.data().makeupAllowed) unsubmittedDocs.push(doc);
      });
      count = unsubmittedDocs.length;
      if (count > 0) {
        if (db.batch) {
          const batch = db.batch();
          unsubmittedDocs.forEach(d => batch.update(d.ref, finalPatch));
          await batch.commit();
        } else {
          await Promise.all(unsubmittedDocs.map(d => d.ref.update(finalPatch)));
        }
      }
    } else {
      const key = 'EVAL_STUDENTS_' + classId;
      const list = this.read(key, []);
      list.forEach(st => {
        if (st.status !== 'submitted') {
          Object.assign(st, finalPatch);
          count++;
        }
      });
      if (count > 0) {
        this.write(key, list);
        this.notify(classId, { replaceStudents: true, students: list });
      }
    }
    return count;
  }
  listenStudent(classId, studentNum, callback, onError = error => alert(error.message)) {
    const docId=this.identity(classId,studentNum),db=this.getDb();
    if(db) return db.collection('classrooms').doc(classId).collection('students').doc(docId).onSnapshot(doc=>{callback(doc.exists?doc.data():null);},onError);
    return this.demoListen(classId,()=>{const student=this.read('EVAL_STUDENTS_'+classId,[]).find(item=>item.numStr===docId);callback(student||null);});
  }
  async savePart3Review(classId,studentNum,sourceKey,details,kind='proposal'){
    const user=await window.authService.teacher({classId}),docId=this.identity(classId,studentNum),db=this.getDb();
    if(!['proposal','confirmed'].includes(kind))throw Error('검토 종류를 확인해 주세요.');
    const criteria=validateAssessmentCriteria(details.criteria);
    const update=(student,session)=>{
      if(![3, 4].includes(session?.questionVersion)||student?.status!=='submitted'||student.attemptId!==session.attemptId||sourceKey!==assessmentSourceKey(student.answers?.part3))throw Error('답안이나 회차가 변경되었습니다. 답안을 다시 열어 검토해 주세요.');
      if(kind==='proposal'&&details.attemptId!==student.attemptId)throw Error('이전 회차의 AI 결과입니다.');
      return {...student.review,[kind]:{criteria,sourceKey,attemptId:student.attemptId,reviewerUid:user.uid,createdAt:new Date().toISOString(),rubricVersion:'open-design-v1',...(kind==='proposal'?{model:String(details.model||''),uncertainties:(details.uncertainties||[]).slice(0,5)}:{})}};
    };
    if(db){
      const sessionRef=db.collection('classrooms').doc(classId),ref=sessionRef.collection('students').doc(docId);
      await db.runTransaction(async tx=>{const session=await tx.get(sessionRef),student=await tx.get(ref);tx.update(ref,{review:update(student.data(),session.data())});});
    }else{
      const student=this.read('EVAL_STUDENTS_'+classId,[]).find(s=>s.numStr===docId),session=this.read('EVAL_SESSION_'+classId,null);
      const review=update(student,session);this.mergeLocalStudent(classId,{...student,review});this.notify(classId,{students:[{...student,review}]});
    }
  }
  formatNeisCSVRows(classId, studentList=[]) {
    const statusMap = {
      submitted: '제출완료',
      in_progress: '풀이중',
      waiting: '대기중'
    };
    const formatTime = (iso) => {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch {
        return String(iso);
      }
    };
    const rows = [['학급','번호','이름','응시상태','객관식/30','단답형/30','지필소계/60','순서도/40','자동채점 총점','교사 조정','최종 점수','제출시각']];
    [...studentList].sort((a,b)=>a.num-b.num).forEach(student=>{
      const score=student.scores||{};
      const serverPending=score.serverGraded === true;
      const statusText = statusMap[student.status] || student.status || '';
      const part1 = serverPending ? '서버 채점 확인' : (Number(score.part1) || 0);
      const part2 = serverPending ? '서버 채점 확인' : (Number(score.part2) || 0);
      const writtenSubtotal = serverPending ? '서버 채점 확인' : (part1 + part2);
      const part3 = score.pendingReview ? '채점 대기' : (score.part3 ?? 0);
      const total = score.pendingReview ? '채점 대기' : (score.total ?? 0);
      const override = score.teacherOverride ?? '';
      const finalScore = score.pendingReview ? '채점 대기' : (score.teacherOverride ?? score.total ?? 0);
      const submittedAt = formatTime(student.submittedAt);
      rows.push([classId, student.num, student.name, statusText, part1, part2, writtenSubtotal, part3, total, override, finalScore, submittedAt]);
    });
    return rows;
  }
  exportNeisCSV(classId, studentList=[]) {
    const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
    const rows=this.formatNeisCSVRows(classId, studentList);
    const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=classId+'_평가.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
window.evalService = new EvalService();
if (typeof module !== 'undefined') module.exports = { EvalService };

