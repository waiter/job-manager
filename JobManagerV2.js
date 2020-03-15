class JobManager {
  constructor(config, startData = null) {
    // 缓存流程配置
    this.config = [];
    // 缓存流程中产出结果
    this.cacheData = {
      '-1': startData,
    };
    // 记录当前执行中的任务Id
    this.jobId = 0;
    // 初始化流程信息
    (config || []).forEach((it, ind) => {
      this.cacheData[ind] = null;
      this.config.push({
        ...it,
      });
    });
    // 重置任务状态
    this.resetCurrent();
  }

  // 任务初始值设置
  setStartData(startData) {
    this.cacheData[-1] = startData;
  }

  // 重置当前任务状态
  resetCurrent() {
    this.current = {
      step: -1,
      resolve: null,
      reject: null,
    };
  }

  // 返回Promise
  start(name) {
    // 不传流程名时，默认全跑
    let needStep = 0;
    if (name) {
      // 根据流程名判断需要跑的任务
      needStep = this.config.findIndex(it => it.name === name);
      if (needStep === -1) {
        return Promise.reject({ error: '没有找到对应任务' });
      }
    }
    const { step, reject: beforeReject } = this.current;
    // 之前有任务在跑
    if (step > -1) {
      // 之前任务优先级更高
      if (step < needStep) {
        return Promise.reject({ cancel: '有更高优先级任务在跑' });
      } else {
        // 告知外部之前任务被取消
        beforeReject({ cancel: '有新高优先级任务' });
      }
    }
    return new Promise((resolve, reject) => {
      // 准备需执行的任务信息
      this.current = {
        step: needStep,
        resolve,
        reject,
      };
      // 变更执行id
      this.jobId += 1;
      // 开始执行
      this.runJob();
    });
  }

  runJob() {
    const { step, reject: beforeReject } = this.current;
    const job = this.config[step];
    const data = this.cacheData[step - 1];
    const jobId = this.jobId;
    try {
      const funcOrData = job.func ? job.func(data) : data;
      if (typeof funcOrData === 'function') {
        const timer = setTimeout(() => {
          this.current.reject = beforeReject;
          if (jobId !== this.jobId) {
            return;
          }
          funcOrData().then(d => {
            // 丢弃历史结果
            if (jobId === this.jobId) {
              this.cacheData[step] = d;
              this.next();
            }
          }).catch(e => {
            // 丢弃历史结果
            if (jobId === this.jobId) {
              this.error(e);
            }
          });
        }, 500);
        this.current.reject = (...arg) => {
          clearTimeout(timer);
          beforeReject(...arg);
        };
      } else {
        this.cacheData[step] = funcOrData;
        this.next();
      }
    } catch( e ) {
      this.error(e);
    }
  }

  // 执行下一个流程
  next() {
    const { step, resolve } = this.current;
    if (step < 0 || step >= this.config.length) {
      throw new Error('未知错误');
    } else if (step === this.config.length - 1) {
      // 流程执行结束
      resolve(this.cacheData[step]);
      this.resetCurrent();
    } else {
      // 执行下一个流程
      this.current.step += 1;
      this.runJob();
    }
  }

  error(e) {
    const { reject } = this.current;
    reject && reject(e);
    this.resetCurrent();
  }
}

module.exports = JobManager;
