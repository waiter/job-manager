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

    start(name) {
        // 返回一个Promise
        return new Promise((resolve, reject) => {
            // 不传流程名时，默认全跑
            let needStep = 0;
            if (name) {
                // 根据流程名判断需要跑的任务
                needStep = this.config.findIndex(it => it.name === name);
                if (needStep === -1) {
                    reject({ error: '没有找到对应任务' });
                    return;
                }
            }
            const { step, reject: beforeReject } = this.current;
            // 之前有任务在跑
            if (step > -1) {
                // 之前任务优先级更高
                if (step < needStep) {
                    reject({ cancel: '有更高优先级任务在跑' });
                    return;
                } else {
                    // 告知外部之前任务被取消
                    beforeReject({ cancel: '有新高优先级任务' });
                }
            }
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
        const { step } = this.current;
        const job = this.config[step];
        const data = this.cacheData[step - 1];
        const jobId = this.jobId;
        try {
            if (job.func) {
                job.func(data).then(d => {
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
            } else {
                this.cacheData[step] = data;
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


// 简单测试用例
const jobConfig = [
    {
        name: 'p1',
        func: (data) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(data ? data + 1 : 1);
                }, 1000);
            });
        },
    },
    {
        name: 'p2',
        func: (data) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(data ? data + 20 : 20);
                }, 2000);
            });
        },
    },
    {
        name: 'p3',
        func: (data) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(data ? data + 300 : 300);
                }, 3000);
            });
        },
    },
];
const jobManager = new JobManager(jobConfig, 3);
jobManager.start().then(data => {
    console.log('first', data);
}).catch(e => console.log('first error', e));
setTimeout(() => {
    jobManager.setStartData(4);
    jobManager.start().then(data => {
        console.log('1500: first', data);
    }).catch(e => console.log('1500: first error', e));
    jobManager.start('p2').then(data => {
        console.log('1500: only p2', data);
    }).catch(e => console.log('1500: only p2 error', e));
}, 1500);