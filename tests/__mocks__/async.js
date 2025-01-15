module.exports = {
  queue: jest.fn((worker, concurrency) => ({
    push: jest.fn(),
    drain: jest.fn().mockResolvedValue(true),
    length: () => 0
  }))
}; 