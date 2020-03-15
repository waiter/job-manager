const JobManager = require('./JobManagerV2');

const delay = time => new Promise(resolve => {
  setTimeout(resolve, time);
});
// 简单测试用例
const jobConfig = [
  {
    name: 'p1',
    func: (data) => {
      return () => new Promise(resolve => {
        setTimeout(() => {
          resolve(data ? data + 1 : 1);
        }, 1000);
      });
    },
  },
  {
    name: 'p2',
    func: (data) => {
      return data ? data + 20 : 20;
    },
  },
  {
    name: 'p3',
    func: (data) => {
      return () => new Promise(resolve => {
        setTimeout(() => {
          resolve(data ? data + 300 : 300);
        }, 3000);
      });
    },
  },
];

let jobManager = null;
beforeEach(() => {
  jobManager = new JobManager(jobConfig, 3);
});
// jest.useFakeTimers();

test('delay', () => {
  expect.assertions(1);
  return delay(1000).then(() => {
    expect(22).toBe(22);
  });
  // jest.runAllTimers();
});

test('base', () => {
  expect(jobManager).not.toBeNull();
});

test('base start', async () => {
  expect.assertions(1);
  await expect(jobManager.start()).resolves.toBe(324);
});

test('change start data', async () => {
  expect.assertions(1);
  jobManager.setStartData(6);
  await expect(jobManager.start()).resolves.toBe(327);
});

test('start with name', () => {
  expect.assertions(3);
  return Promise.all([
    expect(jobManager.start('p1')).rejects.toMatchObject({ cancel: '有新高优先级任务' }),
    expect(jobManager.start('p1')).resolves.toBe(324),
    expect(jobManager.start('p2')).rejects.toMatchObject({ cancel: '有更高优先级任务在跑' }),
  ]);
});

test('start with error name', async () => {
  expect.assertions(1);
  await expect(jobManager.start('e4')).rejects.toMatchObject({ error: '没有找到对应任务' });
});

test('debounce', async () => {
  expect.assertions(3);
  await expect(jobManager.start('p1')).resolves.toBe(324);
  await Promise.all([
    expect(jobManager.start('p3')).rejects.toMatchObject({ cancel: '有新高优先级任务' }),
    expect(delay(300).then(() => jobManager.start('p3'))).resolves.toBe(324),
  ]);
});

test('error', async () => {
  jobManager = new JobManager([{
    name: 'e1',
    func: () => {
      throw new Error('test');
    },
  }], 3);
  await expect(jobManager.start()).rejects.toThrow('test');
});

