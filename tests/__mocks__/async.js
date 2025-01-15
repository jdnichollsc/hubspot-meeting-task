module.exports = {
  queue: (callback) => ({
    push: (task, cb) => {
      callback(task);
      cb();
    },
    drain: () => {}
  })
};
