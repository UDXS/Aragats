function aragats() {
	return {
		compile: compile,
		execute: execute
	};

	function InputStream(data) {
		var pos = 0,
			ln = 1,
			col = 0;
		return {
			next: next,
			peek: peek,
			EOF: EOF,
			fail: fail
		};

		function next() {
			var ret = data.charAt(pos++);
			if (ret == "\n") {
				ln++;
				col = 0;
			} else {
				col++;
			}
			return ret;
		}

		function peek() {
			return data.charAt(pos);
		}

		function EOF() {
			return peek() == "";
		}

		function fail(message) {
			throw new Error(message + " (" + ln + ":" + col + ")");
		}
	}

	function TokenStream(data) {
		var pos = 0;
		return {
			next: next,
			peek: peek,
			EOF: EOF,
			fail: fail
		};

		function next() {
			if (pos < data.length) {
				return data[pos++];
			}
			return null;
		}

		function peek() {
			if (pos < data.length) {
				return data[pos];
			}
			return null;
		}

		function EOF() {
			return peek() == null;
		}

		function fail(message) {
			throw new Error(message + " (Token:" + pos + ")");
		}

		function rewind(amount) {
			if (amount == 0) {
				pos = 0;
				return;
			}
			pos -= amount;
			if (pos < 0) {
				pos = 0;
			}
		}

		function goTo(position) {
			pos = position;
		}

		function getPos() {
			return pos;
		}
	}

	function Tokenizer(stream) {
		return {
			skipWhitespace: skipWhitespace,
			skipComment: skipComment,
			readString: readString,
			readNumber: readNumber,
			readIdentifier: readIdentifier,
			isNumber: isNumber,
			readNext: readNext

		};

		function skipWhitespace() {
			while ((stream.peek() == " " ||
					stream.peek() == "\n" ||
					stream.peek() == "\t" ||
					stream.peek() == "\v") &&
				!stream.EOF()) {
				stream.next();
			}
		}

		function skipComment(multiLine) {
			if (multiLine) {
				while (true) {
					if (!stream.EOF()) {
						if (stream.next() == "*") {
							if (stream.next() == "/") {
								return;
							}
						}
					} else {
						stream.fail("Tokenizer: Multi-line comment does not end at EOL.");
					}
				}
			} else {
				while (!stream.EOF()) {
					if (stream.next() == "\n") {
						return;
					}
				}
			}
		}

		function readString() {
			var str = "";
			var inEscape = false;
			while (true) {
				var ch = stream.next();
				if (inEscape) {
					if (ch == "\\") {
						str += "\\";
					}
					if (ch == "n") {
						str += "\n";
					}
					if (ch == "t") {
						str += "\t";
					}
					if (ch == "v") {
						str += "\v";
					}
					if (ch == "b") {
						str += "\b";
					}
					if (ch == "f") {
						str += "\f";
					}
					if (ch == "r") {
						str += "\r";
					}
					if (ch == "\"") {
						str += "\"";
					}
					inEscape = false;
				} else {
					if (ch != "\\") {
						if (ch == "\"") {
							return str;
						}
						if (ch == "\n") {
							stream.fail("Tokenizer: String does not end at EOL.");
						}
						if (stream.EOF()) {
							stream.fail("Tokenizer: String does not end at EOF.");
						}
						str += ch;
					} else {
						inEscape = true;
					}
				}
			}
		}

		function readNumber() {
			var num = "";
			while (true) {
				if (stream.EOF()) {
					stream.fail("Tokenizer: Number does not end at EOF.");
				}
				var ch = stream.peek();
				if (!isNumber(ch)) {
					break;
				}
				num += ch;
				stream.next();
			}
			return Number(num);
		}

		function readIdentifier() {
			var ident = "";
			while (stream.peek() != " " && stream.peek() != "\n" && stream.peek() != ")" && !stream.EOF()) {
				ident += stream.next();
			}
			if (stream.EOF()) {
				stream.fail("Tokenizer: Identifier does not end at EOF.");
			}
			return ident;
		}

		function isNumber(ch) {
			return (ch >= "0" && ch <= "9") || ch == ".";
		}

		function readNext() {
			if (stream.peek() == " " ||
				stream.peek() == "\n" ||
				stream.peek() == "\t" ||
				stream.peek() == "\v") {
				skipWhitespace();
				return;
			}
			if (stream.peek() == "#") {
				stream.next(); //Consume comment sign
				skipComment(false);
				return;
			}
			if (stream.peek() == "/") {
				stream2 = Object.assign({}, stream);
				stream2.next();
				if (stream2.peek() == "*") {
					stream.next();
					stream.next();
					skipComment(true);
					return;
				}
			}
			if (stream.peek() == "(") {
				stream.next(); //consume the left parenthesis
				return {
					type: "callStart"
				};
			}
			if (stream.peek() == ")") {
				stream.next(); //consume the right parenthesis
				return {
					type: "callEnd"
				};
			}
			if (stream.peek() == "{") {
				stream.next(); //consume the left bracket
				var tokens = [];
				while (!stream.EOF()) {
					var token = readNext();
					if (token == undefined) {
						continue;
					}
					if (token.type == "blockEnd") {
						break;
					}
					tokens.push(token);
					//break;
				}
				if (stream.EOF()) {
					stream.fail("Tokenizer: Block does not end/is empty. ");
				}
				return {
					type: "block",
					code: tokens
				};
			}
			if (stream.peek() == "}") {
				stream.next(); //consume end of block
				return {
					type: "blockEnd"
				};
			}
			if (stream.peek() == "\"") {
				stream.next(); //consume the quotation mark
				return {
					type: "string",
					value: readString()
				};
			}
			if (isNumber(stream.peek()) && stream.peek() != ".") {
				return {
					type: "number",
					value: readNumber()
				};
			}

			if (stream.peek() == "-") {
				stream.next();
				if (isNumber(stream.peek())) {
					return {
						type: "number",
						value: -readNumber()
					};
				}
				return {
					type: "identifier",
					value: "-" + readIdentifier()
				};
			}
			// If it isn"t any of one of those before it, It must be an identifier.
			return {
				type: "identifier",
				value: readIdentifier()
			};
		}
	}

	function preCheck(stream) {
		var blocks = 0,
			calls = 0;
		while (!stream.EOF()) {
			var t = stream.next();
			if (t.type == "blockEnd") {
				blocks++; //"blockEnd" only appears of there is an extra bracket
			}
			if (t.type == "callStart") {
				calls++;
			}
			if (t.type == "callEnd") {
				calls--;
			}
		}
		if (blocks != 0 && calls != 0) {
			stream.fail("PreCheck: Blocks and calls malaligned.");
		}
		if (blocks != 0) {
			stream.fail("PreCheck: Blocks malaligned.");
		}
		if (calls != 0) {
			stream.fail("PreCheck: Calls malaligned.");
		}
	}

	function Parser() {
		return {
			generateBlocks: generateBlocks,
			makeConstants: makeConstants
		};

		function generateBlocks(stream, blocks) {
			if (!blocks) {
				blocks = [];
			}
			var current = [];
			blocks.push(current);
			while (!stream.EOF()) {
				var next = stream.next();
				if (next.type == "block") {
					var tokStream = TokenStream(next.code);
					generateBlocks(tokStream, blocks);
					current.push({
						type: "block",
						value: blocks.length - 1
					});
					continue;
				}
				current.push(next);
			}
			return blocks;
		}

		function makeConstants(blocks) {
			var constBlocks = [];
			var constants = [];
			blocks.forEach(function (element) {
				block = [];
				element.forEach(function (element) {
					if (element.type == "identifier" || element.type == "number" || element.type == "string") {
						if (constants.indexOf(element.value) != -1) {
							block.push({
								type: "const",
								value: constants.indexOf(element.value)
							});
						} else {
							var pos = constants.push({
								type: element.type,
								value: element.value
							});
							block.push({
								type: "const",
								value: pos - 1
							});
						}
					} else {
						block.push(element);
					}
				});
				constBlocks.push(block);
			});
			return {
				blocks: constBlocks,
				constants: constants
			};
		}
	}

	function Compiler() {
		return {
			compile: compile,
			bytecode: bytecode,
			textcode: textcode
		};

		function compile(blocks) {
			var instructions = [];
			blocks.forEach(function (element) {
				var stack = [];
				var block = [];
				element.forEach(function (element) {
					if (element.type == "callStart") {
						stack.push(0);
						return;
					}
					if (element.type == "callEnd") {
						var call = stack.pop();
						block.push({
							type: "call",
							value: call
						});
						return;
					}
					var n = stack.pop();
					n++;
					stack.push(n);
					block.push(element);
				});

				instructions.push(block);
			});
			return instructions;
		}

		function typeToCode(type) {
			if (type == "identifier") {
				return "i";
			}
			if (type == "number") {
				return "n";
			}
			if (type == "string") {
				return "s";
			}
		}

		function insToCode(ins) {
			if (ins == "const") {
				return "c";
			}
			if (ins == "block") {
				return "b";
			}
			if (ins == "call") {
				return "x";
			}
		}

		function textcode(constants, instructions) {
			var text = "UARA;" + constants.length + ";" + instructions.length;
			constants.forEach(function (element) {
				text += typeToCode(element.type);
				if (element.type == "string" || element.type == "identifier") {
					text += escape(element.value) + ";";
					return;
				}
				text += element.value + ";";
			});
			instructions.forEach(function (element) {
				text += element.length + ";";
				element.forEach(function (element) {
					text += insToCode(element.type) + element.value + ";";
				});
			});
			return text;
		}

		function bytecode(constants, instructions) {
			
					}
			
	}

	function compile(program, makeBytecode, debug) {
		var stream = InputStream(program);
		var tokens = [];
		var tokenizer = Tokenizer(stream);
		while (!stream.EOF()) {
			var token = tokenizer.readNext();
			if (token != undefined) {
				tokens.push(token);
			}
		}
		var tokenStream = TokenStream(tokens);
		preCheck(tokenStream);
		tokenStream = TokenStream(tokens);
		parser = Parser();
		var blocks = parser.generateBlocks(tokenStream);
		var constRet = parser.makeConstants(blocks);
		var constBlocks = constRet.blocks;
		var constants = constRet.constants;
		var compiler = Compiler();
		var instructions = compiler.compile(constBlocks);
		var textcode = compiler.textcode(constants, instructions);
		var bytecode = compiler.bytecode(constants, instructions);
		if (debug) {
			return [tokens, blocks, constants, constBlocks, instructions, textcode];
		} else if (makeBytecode) {
			return bytecode;
		} else {
			return textcode;
		}
	}

	function execute(bytecode) {

	}
}
Aragats = aragats();