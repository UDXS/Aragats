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
				var ch = stream.next();
				if (ch == ")" || ch == " ") {
					break;
				}

				if (!(ch >= "0" && ch <= "9") && ch != ".") {
					stream.fail("Tokenizer: Number contains illegal character.");
				}
				num += ch;
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
			if (isNumber(stream.peek())) {
				return {
					type: "number",
					value: readNumber()
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
		var blocks = 0,calls = 0;
		while(!stream.EOF()){
			var t = stream.next();
			if(t.type == "blockEnd"){
				blocks++; //"blockEnd" only appears of there is an extra bracket
			}
			if(t.type == "callStart"){
				calls++;
			}
			if(t.type == "callEnd"){
				calls--;
			}
		}
		if(blocks != 0 && calls != 0){
			stream.fail("PreCheck: Blocks and calls malaligned.");
		}
		if(blocks != 0){
			stream.fail("PreCheck: Blocks malaligned.");
		}
		if(calls != 0){
			stream.fail("PreCheck: Calls malaligned.");
		}
	}
	function Parser() {
		return {
			generateBlocks: generateBlocks,
			MakeConstants: MakeConstants
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
						id: blocks.length - 1
					});
					continue;
				}
				current.push(next);
			}
			return blocks;
		}

		function MakeConstants(blocks){
			
		}
	}

	function compile(program) {
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
		return [tokens, parser.generateBlocks(tokenStream)];
	}

	function execute(bytecode) {

	}
}
Aragats = aragats();