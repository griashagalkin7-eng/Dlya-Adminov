const fs = require('node:fs');
const path = require('node:path');
const { initialState, validateState, applyCommand } = require('./domain.cjs');
class Store {
  constructor(directory) {
    fs.mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, 'ledger.json');
    // Corrupt files are never silently reset or overwritten.
    this.state = fs.existsSync(this.file) ? validateState(JSON.parse(fs.readFileSync(this.file, 'utf8'))) : initialState();
  }
  read() { return structuredClone(this.state); }
  execute(command) {
    const next = applyCommand(this.state, command);
    const temp = `${this.file}.tmp`;
    let fd;
    try {
      fd = fs.openSync(temp, 'w', 0o600);
      fs.writeFileSync(fd, JSON.stringify(next));
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = undefined;
      fs.renameSync(temp, this.file);
    } catch (error) {
      if (fd !== undefined) fs.closeSync(fd);
      throw new Error(`Не удалось сохранить данные. Проверьте доступ к папке и свободное место. ${error.message}`);
    }
    this.state = next;
    return this.read();
  }
}
module.exports = { Store };
