class Schema {
  constructor() {
    this.paths = {};
    this.methods = {};
    this.statics = {};
    this.virtuals = {};
  }

  add(obj) {
    Object.assign(this.paths, obj);
    return this;
  }
}

Schema.Types = {
  ObjectId: String,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Date: Date,
  Mixed: Object,
  Array: Array
};

module.exports = {
  Schema,
  model: jest.fn(),
  connect: jest.fn(),
  Types: Schema.Types
}; 