const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const memoryCache = require('obj-memory-cache');
const safeRegex = require('safe-regex');
const mathExp = require('math-expression-evaluator');

const localCache = memoryCache.newCache();

let mainOptions = {};
let viewsPath = '';
let viewsType = '';

const singleTagsList = ['meta', 'link', 'img', 'br', 'hr', 'input'];

const tagFunctions = {};


/*const log = console.log;
console.log = function() {
	log.apply(console, arguments);
	console.trace();
};*/

addTagFunction('echo', ['str', 'allow_html'], function(options, attrs, content, func){
	let result = setObject(attrs.str, options, true);
	let allow_html = setObject(attrs.allow_html, options);
	if(['string', 'number', 'boolean'].includes(typeof result)){
		result = result.toString();
	}else{result = ''}
	if(allow_html){return runMainFunctions(result, options);}
	return escapeHtml(result);
});

addTagFunction('echo_html', ['str', 'allow_html'], function(options, attrs, content, func){
	let result = setObject(attrs.str, options, true);
	let allow_html = setObject(attrs.allow_html, options);
	if(['string', 'number', 'boolean'].includes(typeof result)){
		result = result.toString();
	}else{result = ''}
	return runMainFunctions(result, options);
});


addTagFunction('if', ['logic'], function(options, attrs, content, func){
	if(!attrs.logic || !content){return false;}
	function checkTrue(logic){
		if(logic.startsWith('(') && logic.endsWith(')')){logic = logic.substring(1, logic.length-1);}
		logic = logic.replace(/^\((.*?)\)$/, '$1').split(/([&|])/g);
		let isTrue = false; let andOr = false;
		function runCheck(str){
			let isNot = false; let loops = 1000;
			while(str.startsWith('!') && loops-- > 0){
				isNot = !isNot;
				str = str.replace('!', '').trim();
			}
			let result;
			if(str.startsWith('(') && str.endsWith(')')){result = checkTrue(str);}
			else{result = checkIf(str, options);}
			if(isNot){return !result;}
			return result;
		}
		for(let i = 0; i < logic.length; i++){
			logic[i] = logic[i].trim();
			if(!logic[i] || logic[i] === ''){continue;}
			if(logic[i] === '&' || logic[i] === '|'){
				andOr = logic[i];
			}else if(!andOr){
				isTrue = runCheck(logic[i]);
			}else if(isTrue && andOr === '&'){
				isTrue = runCheck(logic[i]);
			}else if(!isTrue && andOr === '|'){
				isTrue = runCheck(logic[i]);
			}else{break;}
		}
		return isTrue;
	}
	let result = checkTrue(attrs.logic.toString());
	if(result){return runMainFunctions('<?'+content+'?>', options);}
	return false;
}, true);

function checkIf(str, options){
	function getStrObjs(str){
		str[0] = setObject(str[0], options);
		str[1] = setObject(str[1], options);
		if(typeof str[0] === 'string'){if(str[0].match(/^-?[0-9]+(\.[0-9]+|)$/)){str[0] = Number(str[0]);}else if(str[0] === 'true'){str[0] = true;}else if(str[0] === 'false'){str[0] = false;}}
		else if(Array.isArray(str[0])){str[0] = str[0].length > 0;}else if(typeof str[0] === 'object'){str[0] = Object.keys(str[0]).length > 0;}
		if(typeof str[1] === 'string'){if(str[1].match(/^-?[0-9]+(\.[0-9]+|)$/)){str[1] = Number(str[1]);}else if(str[1] === 'true'){str[1] = true;}else if(str[1] === 'false'){str[1] = false;}}
		else if(Array.isArray(str[1])){str[1] = str[1].length > 0;}else if(typeof str[1] === 'object'){str[1] = Object.keys(str[1]).length > 0;}
		return str;
	}
	if(str.includes('===')){
		str = getStrObjs(str.split('===', 2));
		return str[0] === str[1];
	}else if(str.includes('!==')){
		str = getStrObjs(str.split('!==', 2));
		return str[0] !== str[1];
	}else if(str.includes('==')){
		str = getStrObjs(str.split('==', 2));
		return str[0] === str[1];
	}else if(str.includes('!=')){
		str = getStrObjs(str.split('!=', 2));
		return str[0] !== str[1];
	}else if(str.includes('>=')){
		str = getStrObjs(str.split('>=', 2));
		return str[0] >= str[1];
	}else if(str.includes('<=')){
		str = getStrObjs(str.split('<=', 2));
		return str[0] <= str[1];
	}else if(str.includes('=')){
		str = getStrObjs(str.split('=', 2));
		return str[0] === str[1];
	}else if(str.includes('>')){
		str = getStrObjs(str.split('>', 2));
		return str[0] > str[1];
	}else if(str.includes('<')){
		str = getStrObjs(str.split('<', 2));
		return str[0] < str[1];
	}
	str = setObject(str, options);
	if(typeof str === 'string'){if(str.match(/^-?[0-9]+(\.[0-9]+|)$/)){str = Number(str);}else if(str === 'true'){str = true;}else if(str === 'false'){str = false;}}
	else if(Array.isArray(str)){return str.length > 0;}else if(typeof str === 'object'){return Object.keys(str).length > 0;}
	return str || str === 0;
}


addTagFunction('each', ['obj', 'as', 'of', 'from'], function(options, attrs, content, func){
	//todo: set up each loop
}, true);


addTagFunction('import', ['path'], function(options, attrs, content, func){
	if(!attrs.path){return;}
	let filePath = attrs.path.toString().trim();
	if(!filePath.endsWith(viewsType)){filePath += viewsType;}
	if(!filePath.startsWith(viewsPath)){filePath = path.join(viewsPath, filePath);}
	else{filePath = path.resolve(filePath);}
	if(!filePath.startsWith(viewsPath)){return;}
	let fileData = getFileCache(filePath);
	if(!fileData && fs.existsSync(filePath)){
		fileData = fs.readFileSync(filePath).toString();
		if(!fileData || fileData.trim() === ''){
			setFileCache(filePath, false, options);
			return;
		}
		setFileCache(filePath, fileData, options);
	}
	if(!fileData || fileData.trim() === ''){return;}
	if(!fileData.startsWith('\n')){fileData = '\n\r'+fileData;}
	if(!fileData.endsWith('\n')){fileData += '\n\r';}
	fileData = autoCloseTags(fileData);
	return runMainFunctions(fileData, options);
});


addTagFunction('setUserVar', ['name', 'value'], function(options, attrs, content, func){
	if(!attrs.name || !attrs.value){return;}
	options['$userVars'][attrs.name.toString().trim()] = setObject(attrs.value, options);
});


function addTagFunction(name, attrs, callback, hasContent = false){
	if(typeof name !== 'string' && typeof name !== 'number' && typeof name !== 'boolean'){return;}
	name = name.toString().trim();
	if(typeof attrs === 'function'){
		if(callback){
			let attr = callback;
			callback = attrs;
			attrs = attr;
		}else{callback = attrs;}
	}
	hasContent = !!hasContent;
	if(!Array.isArray(attrs)){attrs = [attrs];}
	attrs = attrs.map(attr => attr.toString().trim());
	tagFunctions[name] = {attrs, callback, hasContent};
	return true;
}

const tagFunctionMethods = {runMainFunctions, escapeHtml, unescapeHtml, escapeRegex, escapeInvalidTags, stripInvalidTags, forEach, autoCloseTags, getFileCache, setFileCache};


function getRandomToken(size){
	return crypto.randomBytes(size).toString('hex');
}


function getFileCache(filePath){
	return localCache.get('template_file:'+filePath);
}

function setFileCache(filePath, data, options){
	if(data){data = data.toString();}
	localCache.set('template_file:'+filePath, data, {expire: options.cache || mainOptions.cache});
}


function engine(filePath, options, callback){
	viewsType = filePath.substr(filePath.lastIndexOf('.'));
	viewsPath = path.join(filePath, '..');
	let fileData = getFileCache(filePath);
	if(fileData){
		if(mainOptions && typeof mainOptions.onBeforeRender === 'function'){
			let beforeRendered = mainOptions.onBeforeRender(Buffer.from(fileData, 'utf8'));
			if(beforeRendered && typeof beforeRendered === 'string'){fileData = beforeRendered;}
		}else if(options && typeof options.onBeforeRender === 'function'){
			let beforeRendered = options.onBeforeRender(Buffer.from(fileData, 'utf8'));
			if(beforeRendered && typeof beforeRendered === 'string'){fileData = beforeRendered;}
		}
		let rendered = render(fileData, options);
		if(mainOptions && typeof mainOptions.onAfterRender === 'function'){
			let afterRendered = mainOptions.onAfterRender(Buffer.from(rendered, 'utf8'));
			if(afterRendered && typeof afterRendered === 'string'){rendered = afterRendered;}
		}else if(options && typeof options.onAfterRender === 'function'){
			let afterRendered = options.onAfterRender(Buffer.from(rendered, 'utf8'));
			if(afterRendered && typeof afterRendered === 'string'){rendered = afterRendered;}
		}
		return callback(null, rendered.toString());
	}else{
		fs.readFile(filePath, function(err, content){
			if(err){return callback(err);}
			setFileCache(filePath, content, options);
			if(mainOptions && typeof mainOptions.onBeforeRender === 'function'){
				let beforeRendered = mainOptions.onBeforeRender(content);
				if(beforeRendered && typeof beforeRendered === 'string'){content = beforeRendered;}
			}else if(options && typeof options.onBeforeRender === 'function'){
				let beforeRendered = options.onBeforeRender(content);
				if(beforeRendered && typeof beforeRendered === 'string'){content = beforeRendered;}
			}
			let rendered = render(content, options);
			if(mainOptions && typeof mainOptions.onAfterRender === 'function'){
				let afterRendered = mainOptions.onAfterRender(Buffer.from(rendered, 'utf8'));
				if(afterRendered && typeof afterRendered === 'string'){rendered = afterRendered;}
			}else if(options && typeof options.onAfterRender === 'function'){
				let afterRendered = options.onAfterRender(Buffer.from(rendered, 'utf8'));
				if(afterRendered && typeof afterRendered === 'string'){rendered = afterRendered;}
			}
			return callback(null, rendered.toString());
		});
	}
}


function render(str, options){

	str = str.toString();

	if(mainOptions && mainOptions.raw){return str;}

	if(!str.startsWith('\n')){str = '\n\r'+str;}
	if(!str.endsWith('\n')){str += '\n\r';}
	str = autoCloseTags(str);

	if(options){
		let opts = {};
		forEach(options, (opt, i) => {
			if(typeof opt === 'function'){return;}
			if(['string', 'number', 'boolean', 'object'].includes(typeof opt) || Array.isArray(opt)){opts[i] = opt;}
		}); options = opts;
	}else{options = {};}
	if(!options.opts || typeof options.opts !== 'object'){options.opts = {};}
	if(!options['$'] || typeof options['$'] !== 'object'){options['$'] = {};}
	if(!options['$functions'] || typeof options['$functions'] !== 'object'){options['$functions'] = {};}
	if(!options['$userVars'] || typeof options['$userVars'] !== 'object'){options['$userVars'] = {};}
	if(!options['$returns'] || typeof options['$returns'] !== 'object'){options['$returns'] = {};}
	if(!options.extractTags){options.extractTags = [];}
	else if(!Array.isArray(options.extractTags)){options.extractTags = [options.extractTags];}
	if(mainOptions.extractTags){
		if(!Array.isArray(mainOptions.extractTags)){mainOptions.extractTags = [mainOptions.extractTags];}
		options.extractTags = [...mainOptions.extractTags, ...options.extractTags];
	}

	//todo: render template

	//todo: add var alias options
	//todo: allow setting vars to objects
	//todo: allow string combining (similar to php)
	//todo: allow custom function creation
	//todo: add some basic regve functions and {{tags}}, to shorten simple tasks
	// make shortened {{tags}} and functions dynamic, and ignore letter cases, -, and _ characters
	//todo: add ability to include simple {{tags}} as shortcodes and {{{tags}}} as html shortcodes
	//todo: allow checking if functions exist
	//todo: allow adding other html files
	//todo: add optional <?php ?> reads and also read <? ?> blank language tags as shorthand
	//todo: include && || detection (allow one & | as alias)
	//todo: detect == and === globally
	//todo: add $__POST, $__GET, and $__DATA as vars, and data combining post then get (also include alias $Post, $Get, and $Data)
	//todo: try and include valid php, to run php files in a similar way (and successfully if possible)
	//todo: add option to ignore advanced <?js ?> mode, and only use simple {{tags}}
	//todo: include escapeHtml and unescapeHtml as advanced functions
	//todo: add dynamic lazy load tag to advanced functions, where import or echo_html string will be checked for {{lazyload}} tags, and auto add lazy load
	// may have user pass req into function options (also for req.body and req.query as post and get requests)
	//todo: set ${userVars} with a <?js function(var); ?> method
	//todo: only set basic functions for regve functions


	//todo: double check safeRegex
	// may find way to scan globally (reading files with fs)
	// may make cli module


	// add template file
	str = getTemplate(str, options);

	//todo: add lazyload support (make sure this is triggered early)

	// run main functions
	str = runMainFunctions(str, options);

	// remove leftover tags
	str = str.replace(/<\?(js|php|).*?\?>/gs, '');
	str = str.replace(/<&[\w_\-]*%.*?%&>/gs, '');

	// run basic regve tags
	str = runRegveTags(str, options);

	// extract tags
	str = extractTags(str, options);

	// escape html in {{#no-html}} tags
	str = str.split(/({{{?#no[_-]html}}}?.*?{{{?\/no[_-]html}}}?)/gsi);
	for(let i = 0; i < str.length; i++){
		if(str[i].match(/({{{?#no[_-]html}}}?.*?{{{?\/no[_-]html}}}?)/gsi)){
			str[i] = escapeHtml(str[i].replace(/{{{?#no[_-]html}}}?(.*?){{{?\/no[_-]html}}}?/gsi, '$1'));
		}else{
			// run user vars outside {{#no-html}} tags
			str[i] = runUserVars(str[i], options);
		}
	}
	str = str.join('');

	// run custom markdown outside {{#no-markdown}} tags
	if(!mainOptions.noMarkdown && !options.noMarkdown){
		str = str.split(/({{{?#no[_-]markdown}}}?.*?{{{?\/no[_-]markdown}}}?)/gsi);
		for(let i = 0; i < str.length; i++){
			if(!str[i].match(/({{{?#no[_-]markdown}}}?.*?{{{?\/no[_-]markdown}}}?)/gsi)){
				str[i] = customMarkdown(str[i], options);
			}else{
				str[i] = str[i].replace(/{{{?#no[_-]markdown}}}?(.*?){{{?\/no[_-]markdown}}}?/gsi, '$1');
			}
		}
		str = str.join('');
	}

	// remove leftover tags
	str = str.replace(/<\?(js|php|).*?\?>/gs, '').replace(/\?>/gs, '');
	str = str.replace(/<&[\w_\-]*%.*?%&>/gs, '');

	// remove leftover regve tags
	str = str.replace(/{{{?.*?}}}?/gs, '');

	//todo: minify html output
	return str.toString().trim();
}


function runUserVars(str, options){
	str = str.replace(/\$\{(.*?)\}/gm, function(str, varName){
		varName = varName.trim();
		if(options['$userVars'][varName]){return options['$userVars'][varName];}
		return '';
	});
	if(options.noHtmlRules && options.noHtmlRules.allowUserVars){
		str = str.replace(/\$&lbrace;(.*?)&rbrace;/gm, function(str, varName){
			varName = varName.trim();
			if(options['$userVars'][varName]){return options['$userVars'][varName];}
			return '';
		});
	}
	return str;
}


function getTemplate(str, options){
	if(options.template || mainOptions.template){
		let filePath = options.template || mainOptions.template;
		if(!filePath.endsWith(viewsType)){filePath += viewsType;}
		if(!filePath.startsWith(viewsPath)){filePath = path.join(viewsPath, filePath);}
		else{filePath = path.resolve(filePath);}
		if(!filePath.startsWith(viewsPath)){return str;}
		let fileData = getFileCache(filePath);
		if(!fileData && fs.existsSync(filePath)){
			fileData = fs.readFileSync(filePath).toString();
			if(!fileData || fileData.trim() === ''){
				setFileCache(filePath, false, options);
				return str;
			}
			setFileCache(filePath, fileData, options);
		}
		if(!fileData || fileData.trim() === ''){return str;}
		if(!fileData.startsWith('\n')){fileData = '\n\r'+fileData;}
		if(!fileData.endsWith('\n')){fileData += '\n\r';}
		fileData = autoCloseTags(fileData);
		str = fileData.replace(/(<\?(js|php|)\s*?body\(\);?\s*?\?>|{{{?#?\s*?body\s*?}}}?)/gs, str);
	}
	return str;
}


function runMainFunctions(str, options){
	return str.replace(/<\?(js|php|)(.*?)\?>/gs, function(str, type, content){
		let result = '';

		function setResult(str){
			if(['string', 'number', 'boolean'].includes(typeof str)){
				return str.toString();
			}return '';
		}

		content = content.replace(/\/\*.*?\*\//gs, '').replace(/\/\/.*/gm, '');

		const funcMethods = {...tagFunctionMethods};
		funcMethods.result = function(str){result += setResult(str);};
		funcMethods.setResult = setResult;

		content = content.replace(/[\n\r\t\s]/gs, ' ').replace(/\s\s/gs, ' ')
		.replace(/else\s*?{/gs, 'else if(true){');

		const functionContent = {};
		let loops = 1000;
		while(content.match(/\{([^{}]*)\}/gs) && loops-- > 0){
			content = content.replace(/\{([^{}]*)\}/gs, function(str, content){
				let index = getRandomToken(16)+getRandomToken(16);
				functionContent[index] = content;
				return '<&%'+index+'%&>';
			});
		}
		content = content.replace(/<&%(.*?)%&>/gs, function(str, content){
			return '{<&%'+content+'%&>}';
		});

		content = content.replace(/function\s*?([\w_\-.\[\]]+)\((.*?)\)\s*?\{<&%(.*?)%&>\}/gs, function(str, funcName, attrStr, content){
			if(functionContent[content]){content = functionContent[content];}
			else{content = '';}
			attrStr = attrStr.split(',').map(attr => attr.trim()).filter(attr => attr && attr !== '');
			let loops = 1000;
			while(content.match(/<&%(.*?)%&>/gs) && loops-- > 0){
				content = content.replace(/<&%(.*?)%&>/gs, function(str, index){
					if(functionContent[index]){
						return '{'+functionContent[index]+'}';
					}return '{}';
				});
			}
			options['$functions'][funcName] = function(options, attrs){
				const funcContent = content;
				const attrList = attrStr;
				const attrsObj = {};
				for(let i = 0; i < attrs.length; i++){
					let attrName = attrList[i] || i;
					attrsObj[attrName] = setObject(attrs[i], options);
				}
				let funcResult = runMainFunctions('<? '+funcContent.replace(/\$([\w_\-.\[\]]+)/gs, function(str, varName){
					varName = '$'+varName.toString().trim();
					if(attrsObj[varName]){
						return setObject(attrsObj[varName], options);
					}return str;
				})+' ?>', options);
				let funcReturn = false;
				funcResult = funcResult.replace(/<&return%(.*?)%&>.*?/gs, function(str, index){
					if(!funcReturn){
						//todo: add return function to set options['$return'] to a random index, and echo the index
						// regex uses <&return%(.*?)%&>
						funcReturn = options['$returns'][index];
					}return '';
				});
				return {result: funcResult, return: funcReturn};
			};
			return '';
		});

		content = content.split(/(.*?[;}])/gs).filter(str => str && str.trim() !== '')
		.map(str => {
			str = str.replace(/\{<&%(.*?)%&>\}/gs, function(str, index){
				if(index && index.trim() !== '' && functionContent[index]){
					return '{'+functionContent[index]+'}';
				}return '{}';
			});
			let loops = 0;
			while(str.match(/<&%(.*?)%&>/gs) && loops-- > 0){
				str = str.replace(/<&%(.*?)%&>/gs, function(str, index){
					if(index && index.trim() !== '' && functionContent[index]){
						return '{'+functionContent[index]+'}';
					}return '{}';
				});
			}
			return str;
		});

		const funcOpts = {runElse: false};

		for(let i = 0; i < content.length; i++){
			content[i] = content[i].trim();
			if(content[i].startsWith('echo_html ')){
				result += runMainFunctions(setResult(setObject(content[i].replace(/^echo_html\s*/, ''), options, true)), options);
			}else if(content[i].startsWith('echo ')){
				result += escapeHtml(setResult(setObject(content[i].replace(/^echo\s*/, ''), options, true)));
			}else if(content[i].match(/^\$[\w_\-.\[\]]+\s*?[+\-*\/.]?=\s*?.*?/)){
				content[i].replace(/^\$([\w_\-.\[\]]+)\s*?([+\-*\/.]|)=\s*?(.*?)[;}]/, function(str, varName, operation, value){
					value = setObject(value, options, false, {funcOpts, funcMethods});
					if(!operation || operation.trim() === ''){
						//todo: handle setting object level vars
						options['$'][varName] = value;
						return;
					}
					let varValue = options['$'][varName];
					if(typeof varValue === 'string' && varValue.match(/^-?[0-9]+(\.[0-9]+|)$/) && Number(varValue)){varValue = Number(varValue);}

					if(Array.isArray(varValue)){
						if(operation === '+' || operation === '.' || operation === '*'){
							options['$'][varName].push(value);
						}else if(operation === '-' || operation === '/'){
							let valIndex = varValue.indexOf(value);
							if(valIndex){
								options['$'][varName].splice(varValue.indexOf(value), 1);
							}
						}
						return;
					}

					if(typeof varValue === 'object' && typeof value === 'object'){
						if(operation === '+' || operation === '.' || operation === '*'){
							let keys = Object.keys(value);
							for(let k = 0; k < keys.length; k++){
								varValue[keys[k]] = value[keys[k]];
							}
							options['$'][varName] = varValue;
						}else if(operation === '-' || operation === '/'){
							let varKeys = Object.keys(varValue);
							let varValues = Object.values(varValue);
							let values = Object.values(value);
							for(let v = 0; v < values.length; v++){
								delete varValue[varKeys[varValues.indexOf(values[v])]];
							}
						}
						return;
					}

					if(typeof varValue === 'object' && (typeof value === 'string' || Array.isArray(value)) && (operation === '-' || operation === '/')){
						let varKeys = Object.keys(varValue);
						let varValues = Object.values(varValue);
						if(!Array.isArray(value)){value = [value];}
						for(let v = 0; v < value.length; v++){
							delete varValue[varKeys[varValues.indexOf(value[v])]];
						}
						return;
					}

					if(!['string', 'boolean', 'number'].includes(typeof value) || !['string', 'boolean', 'number'].includes(typeof varValue)){
						return;
					}

					if(operation === '+' || operation === '.'){
						options['$'][varName] = varValue + value;
					}else if(operation === '-' && typeof value === 'number' && typeof varValue === 'number'){
						options['$'][varName] = varValue - value;
					}else if(operation === '-'){
						options['$'][varName] = varValue.replace(value, '');
					}else if(operation === '*' && typeof value === 'number' && typeof varValue === 'string'){
						options['$'][varName] = varValue.repeat(value);
					}else if(operation === '*' && typeof value === 'number' && typeof varValue === 'number'){
						options['$'][varName] = varValue * value;
					}else if(operation === '*'){
						options['$'][varName] = varValue + value;
					}else if(operation === '/' && typeof value === 'number' && typeof varValue === 'number'){
						options['$'][varName] = varValue / value;
					}else if(operation === '/'){
						let regex = new RegExp(escapeRegex(value), 'g');
						if(safeRegex(regex)){options['$'][varName] = varValue.replace(regex, '');}
					}
				});
			}else if(content[i].match(/^(else |)[\w_\-.\[\]]+\(.*?\)(\{.*?\}|)/)){

				let funcResult = runFunction(content[i], options, funcOpts.runElse, funcMethods);
				funcOpts.runElse = funcResult.runElse;
				if(funcResult.result){
					result += funcResult.result.toString();
				}
				if(funcResult.return && ['string', 'number', 'boolean'].includes(typeof funcResult.return)){
					result += funcResult.return.toString();
				}

			}
		}

		return result;
	});
}


function runFunction(str, options, runElse = false, funcMethods){
	let result = ''; let returnResult = false;
	str.replace(/^(else |)([\w_\-.\[\]]+)\((.*?)\)(?:\{(.*?)\}|)/, function(str, hasElse, funcName, attrStr, content){

		if(!runElse && hasElse && hasElse.trim() !== ''){return;}
		runElse = false;

		if(!attrStr){attrStr = '';}
		else{attrStr = attrStr.toString();}

		if(options['$functions'][funcName]){
			attrStr = attrStr.split(',').map(attr => attr.trim()).filter(attr => attr && attr !== '');
			let funcResult = options['$functions'][funcName](options, attrStr);
			if(funcResult.result){result += funcResult.result.toString();}
			if(funcResult.return){returnResult = funcResult.return;}
		}else if(tagFunctions[funcName]){
			attrStr = attrStr.split(',').map(attr => attr.trim()).filter(attr => attr && attr !== '');

			let attrObj = {};
			if(tagFunctions[funcName].attrs){
				let attrValues = tagFunctions[funcName].attrs;
				for(let i = 0; i < attrValues.length; i++){
					attrObj[attrValues[i]] = attrStr.shift();
				}
			}
			for(let i = 0; i < attrStr.length; i++){
				if(!attrObj[i]){attrObj[i] = attrStr[i];}
			}

			funcMethods.setObject = function(str, returnString){return setObject(str, options, returnString);};

			let funcResult = undefined;
			if(tagFunctions[funcName].hasContent && content && content.toString().trim() !== ''){
				funcResult = tagFunctions[funcName].callback(options, attrObj, content.toString(), funcMethods);
			}else if(tagFunctions[funcName]){
				funcResult = tagFunctions[funcName].callback(options, attrObj, null, funcMethods);
			}

			if(funcResult === false){
				runElse = true;
				returnResult = false;
			}else{returnResult = funcResult;}
		}
	});
	return {result, return: returnResult, runElse}
}


function setObject(str, options, returnString = false, funcData = false){
	if(!str || !['string', 'number', 'boolean'].includes(typeof str)){return;}
	str = str.toString().trim();

	if(str.endsWith(';')){str = str.substring(0, str.length-1);}

	let isRegve = false;
	if(returnString === 'regve'){
		isRegve = true;
	}


	let hasFunctions = false;
	if(!isRegve && funcData && typeof str === 'string' && str.match(/([\w_\-$]+)\((.*?)\)/)){
		hasFunctions = true;
		//todo: handle functions (use runFunction())
		// remember to work with string combined functions, and returned values
		// remember to add fix for inner function selection
		// may run functions early if possible
	}


	if((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))){
		try{
			let result = JSON.parse(normalizeJson(str));
			if(returnString){return JSON.stringify(result);}
			return result;
		}catch(e){}
	}

	const stringObjs = {};
	str = str.replace(/(['"])(.*?)\1/gs, function(str, quote, string){
		let index = getRandomToken(16)+getRandomToken(16);
		stringObjs[index] = string;
		return quote+'<&%'+index+'%&>'+quote;
	});

	str = str.split(/((?:[0-9+\-*/^().e!]|pi|sin|cos|tan|asin|acos|atan|root|pow)+)/gs);
	for(let i = 0; i < str.length; i++){
		if(str[i] && str[i].trim() !== '' && !str[i].match(/^[\w0-9.]+$/s) && str[i].match(/^([0-9+\-*/^().e!]|pi|sin|cos|tan|asin|acos|atan|root|pow)+$/s)){
			str[i] = str[i].split(/^([+\-*/.]*)(.*?)([+\-*/.]*)$/s);
			if(str[i][2]){
				str[i][2] = solveMathStr(str[i][2]);
			}
			str[i] = str[i].join('');
		}
	}

	str = str.join('').split(/([+\-*\/]|\.(?=[^\w_0-9])|[^\w_0-9]\.(?=[0-9]))/g);

	if(str.length > 1){returnString = true;}

	let result = ''; let sign = '.';

	function addResult(str){
		if(typeof str === 'undefined'){return '';}
		if(sign === '.' || sign === '+'){
			result += str.toString();
		}else if(sign === '-'){
			result = result.replace(str.toString(), '');
		}else if(sign === '*' && (typeof str === 'number' || str.toString().match(/^[0-9]+(\.[0-9]+|)$/))){
			result = result.repeat(Number(str));
		}else if(sign === '*'){
			result += str.toString();
		}else if(sign === '/'){
			let regex = new RegExp(escapeRegex(str.toString()), 'g');
			if(safeRegex(regex)){result = result.replace(regex, '');}
		}
	}

	for(let i = 0; i < str.length; i++){

		if(str[i].match(/^(['"])\s*?\.\s*?\1?.?$/)){
			str[i] = '.';
		}

		if(['.', '+', '-', '*', '/'].includes(str[i].trim())){
			sign = str[i].trim();
			continue;
		}

		if(str[i].trim().match(/^[0-9]+(\.[0-9]+|)$/s)){
			addResult(str[i].trim());
			continue;
		}

		if(str[i].trim().match(/^(['"])<&%(.*)%&>(\1|)$/)){
			str[i] = str[i].trim().replace(/^(['"])<&%(.*)%&>(\1|)$/, function(str, quote, index){
				if(stringObjs[index]){
					return quote+stringObjs[index]+quote;
				}return quote+quote;
			});
		}

		if(str[i].match(/^(['"]).*\1.?$/)){
			addResult(str[i].trim().replace(/^(['"])(.*)\1.?$/, '$2'));
		}else if(str[i].match(/^(['"]).*.?$/)){
			if(str[i+1] && str[i+1].match(/^(['"])\s*?\.\s*?.?$/)){
				if(str[i+1].startsWith('\'')){str[i] += '\'';}
				else if(str[i+1].startsWith('"')){str[i] += '"';}
			}
			addResult(str[i].trim().replace(/^(['"])(.*)\1.?$/, '$2'));
		}else{addResult(getVar(str[i].trim()));}
	}

	function getVar(str){
		str = str.split('|');
		let result = undefined;
		for(let i = 0; i < str.length; i++){
			result = getVarResult(str[i]);
			if(result){break;}
		}
		if(isRegve && result === undefined){result = '';}
		return result;
	}

	function getVarResult(str){
		let result;
		if(str === 'true'){
			return true;
		}else if(str === 'false'){
			return false;
		}else if(isRegve && str.startsWith('$')){
			result = getObj(str.replace('$', ''), options['$']);
		}else if(isRegve){
			result = getObj(str, options.opts);
		}else if(str.startsWith('$Opts.') || str.startsWith('$Options.') || str.startsWith('$_OPTIONS.') || str.startsWith('$_OPTS.')){
			result = getObj(str.replace(/^\$_?opt(?:ion)?s(\.|\[(.*?|)\])/i, regexGetObjPath), options.opts);
		}else if(str.startsWith('$Post.') || str.startsWith('$_POST.')){
			result = getObj('req.body.'+str.replace(/^\$_?post(\.|\[(.*?|)\])/i, regexGetObjPath), options);
		}else if(str.startsWith('$Get.') || str.startsWith('$_GET.')){
			result = getObj('req.query.'+str.replace(/^\$_?get(\.|\[(.*?|)\])/i, regexGetObjPath), options);
		}else if(str.startsWith('$Data.') || str.startsWith('$_DATA.')){
			result = getObj('req.data.'+str.replace(/^\$_?data(\.|\[(.*?|)\])/i, regexGetObjPath), options);
		}else if(str.startsWith('$')){
			result = getObj(str.replace('$', ''), options['$']);
		}else{result = getObj(str, options['$']);}
		if(returnString){
			if((!result && result !== 0) || !['string', 'number', 'boolean'].includes(typeof result)){result = undefined;}
			else{result = result.toString();}
		}return result;
	}

	function regexGetObjPath(str, value){
		if(value){return value.replace(/\s/g, '').replace(/^\.*/, '');}
		return '';
	}

	//todo: setup to handle grabbing objects, arrays, or strings (created or from options)
	// include support for creating an array with options

	if(returnString){
		if(!['string', 'number', 'boolean'].includes(typeof result)){result = '';}
		return result.toString();
	}

	if(typeof result === 'string' && result.match(/^-?[0-9]+(\.[0-9]+|)$/)){
		result = Number(result);
	}else if(result === 'true'){
		result = true;
	}else if(result === 'false'){result = false;}

	return result;
}


function solveMathStr(str){
	str = str.toString();
	try{str = mathExp.eval(str);}catch(e){str = 'NaN';}
	return str;
}


function runRegveTags(str, options){
	return str.replace(/({{{?)(.*?)(}}}?)/gs, function(str, open, content, close){
		if(!content || content.trim() === ''){return '';}
		const doEscapeHtml = open !== '{{{' || close !== '}}}';
		content = content.toString().trim();

		//todo: add in noHtml and noMarkdown tags (may handle in render function)

		if(content.startsWith('-')){
			content = content.substring(1).trim();
			options.extractTags.push(content);
			return '{{-'+content+'}}';
		}else if(content.includes('=')){
			content = content.split('=', 2);
			if(!content[1] || content[1].trim() === ''){return '';}
			content[1] = content[1].trim();
			if(content[1].startsWith('"') && content[1].endsWith('"')){content[1] = content[1].substring(1, content[1].length-1);}
			if(!content[0] || content[0].trim() === ''){content[0] = content[1];}
			else{content[0] = content[0].trim();}
			if(content[0].includes('.')){content[0] = content[0].split('.', 1)[0];}
			if(content[0].includes('[')){content[0] = content[0].split('[', 1)[0];}
			let result = setObject(content[1], options, 'regve');
			if(doEscapeHtml){result = escapeHtml(result);}
			return content[0]+'="'+result+'"';
		}else{
			if(content.startsWith('"') && content.endsWith('"')){content = content.substring(1, content[1].length-1);}
			let result = setObject(content, options, 'regve');
			if(doEscapeHtml){result = escapeHtml(result);}
			return result;
		}
	});
}


function extractTags(str, options){
	if(options.extractTags && options.extractTags.length && Array.isArray(options.extractTags)){
		let extractTagsStr = options.extractTags.map(tag => escapeRegex(tag.toString())).join('|');
		if(options.extractTags.includes('style') && !options.extractTags.includes('link')){extractTagsStr += '|link';}
		let extractTagsRegex = new RegExp('<('+extractTagsStr+')(\\s+?.*?|)>(.*?)<\\/(?:'+extractTagsStr+')(?:\\s+?.*?|)>', 'gs');
		if(safeRegex(extractTagsRegex)){
			const extractedTags = {};
			str = str.replace(extractTagsRegex, function(str, tagName, attrs, content){
				tagName = tagName.trim();
				let htmlTag = '<'+tagName+' '+attrs.trim()+'>'+content+'</'+tagName+'>';
				if(tagName === 'link' && options.extractTags.includes('style') && attrs.match(/\s+?rel="stylesheet"/gs)){
					if(!extractedTags['style']){extractedTags['style'] = [];}
					extractedTags['style'].push(htmlTag);
					return '';
				}else if(tagName !== 'link' || (options.extractTags.includes('link') && !attrs.match(/\s+?rel="stylesheet"/gs))){
					if(!extractedTags[tagName]){extractedTags[tagName] = [];}
					extractedTags[tagName].push(htmlTag);
					return '';
				}return htmlTag;
			});
			extractTagsRegex = new RegExp('{{-('+extractTagsRegex+')}}', 'gs');
			if(safeRegex(extractTagsRegex)){
				str = str.replace(extractTagsRegex, function(str, tagName){
					if(extractedTags[tagName]){
						return extractedTags[tagName].join('\n');
					}return '';
				});
			}
		}
	}return str;
}


function customMarkdown(str, options){
	if(!str && str !== 0 && str !== false){return null;}

	str = str.toString();

	let opts = {};
	if(typeof mainOptions.noHtmlRules === 'object' && typeof options.noHtmlRules === 'object'){
		opts = {...mainOptions.noHtmlRules, ...options};
	}else if(typeof mainOptions.noHtmlRules === 'object'){
		opts = {...mainOptions.noHtmlRules};
	}else if(typeof options.noHtmlRules === 'object'){
		opts = {...options.noHtmlRules};
	}

	//todo: fix escaped html to still run some markdown
	// add options to choose what can be run

	str = str.replace(/(?:\*|&ast;){3}([^*]+)(?:\*|&ast;){3}/g, '<strong><em>$1</em></strong>');
	str = str.replace(/(?:\*|&ast;){2}([^*]+)(?:\*|&ast;){2}/g, '<strong>$1</strong>');
	str = str.replace(/(?:\*|&ast;)([^*]+)(?:\*|&ast;)/g, '<em>$1</em>');

	str = str.replace(/__([^_]+)__/g, '<u>$1</u>');
	str = str.replace(/~~([^~]+)~~/gs, '<s>$1</s>');

	str = str.replace(/(?:#){6}\s*(.+)/g, '<h6>$1</h6>');
	str = str.replace(/(?:#){5}\s*(.+)/g, '<h5>$1</h5>');
	str = str.replace(/(?:#){4}\s*(.+)/g, '<h4>$1</h4>');
	str = str.replace(/(?:#){3}\s*(.+)/g, '<h3>$1</h3>');
	str = str.replace(/(?:#){2}\s*(.+)/g, '<h2>$1</h2>');
	str = str.replace(/(?:#)\s*(.+)/g, '<h1>$1</h1>');

	if(opts.allowHeaders){
		str = str.replace(/(?:&num;){6}\s*(.+)/g, '<h6>$1</h6>');
		str = str.replace(/(?:&num;){5}\s*(.+)/g, '<h5>$1</h5>');
		str = str.replace(/(?:&num;){4}\s*(.+)/g, '<h4>$1</h4>');
		str = str.replace(/(?:&num;){3}\s*(.+)/g, '<h3>$1</h3>');
		str = str.replace(/(?:&num;){2}\s*(.+)/g, '<h2>$1</h2>');
		str = str.replace(/(?:&num;)\s*(.+)/g, '<h1>$1</h1>');
	}

	str = str.replace(/[\n\r]-{3,}[\n\r]/g, '<hr>');

	str = str.replace(/(?:`|&grave;){3}(.+?)(?:`|&grave;){3}/gs, '<pre>$1</pre>');
	str = str.replace(/(?:`|&grave;)(.+?)(?:`|&grave;)/gs, '<p>$1</p>');

	str = str.replace(/([^"'])((?!["'])https?:\/\/(?:(?:[\w_-][\w_\-.]+)|)(?:(?:[\w.,@?^=%&:/~+#_-]*[\w.,@?^=%&:/~+#_-])|))/g, '$1<a href="$2">$2</a>');

	str = str.replace(/\!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
	str = str.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

	if(opts.allowImages){
		str = str.replace(/\!&lbrack;(.*?)&rbrack;&lpar;(.*?)&rpar;/g, '<img src="$2" alt="$1">');
	}
	if(opts.allowCustomLinks){
		str = str.replace(/&lbrack;(.*?)&rbrack;&lpar;(.*?)&rpar;/g, '<a href="$2">$1</a>');
	}

	// custom symbols
	str = str.replace(/\[ss\]/g, '§');
	str = str.replace(/\[$c\]/g, '¢');
	str = str.replace(/\[$e\]/g, '€');
	str = str.replace(/\[$p\]/g, '£');
	str = str.replace(/\[c\]/g, '©');
	str = str.replace(/\[r\]/g, '®');
	str = str.replace(/\[tm\]/g, '™');
	str = str.replace(/\[p\]/g, '¶');
	str = str.replace(/\[Dc\]/g, '℃');
	str = str.replace(/\[Df\]/g, '℉');
	str = str.replace(/\[D\]/g, '°');

	str = str.replace(/\[M\+\]/g, '+');
	str = str.replace(/\[M-\]/g, '−');
	str = str.replace(/\[Mx\]/g, '×');
	str = str.replace(/\[M\/\]/g, '÷');

	str = str.replace(/\[M=\]/g, '=');
	str = str.replace(/\[M\!=\]/g, '≠');
	str = str.replace(/\[M\+-\]/g, '±');

	str = str.replace(/\[M<\]/g, '<');
	str = str.replace(/\[M>\]/g, '>');
	str = str.replace(/\[M<=\]/g, '⋜');
	str = str.replace(/\[M>=\]/g, '⋝');

	str = str.replace(/\[M%\]/g, '%');
	str = str.replace(/\[M%0\]/g, '‰');
	str = str.replace(/\[M%00\]/g, '‱');

	str = str.replace(/\[Msum\]/g, '∑');
	str = str.replace(/\[M(sqrt|2root|root)\]/g, '√');
	str = str.replace(/\[M(cbrt|3root)\]/g, '∛');
	str = str.replace(/\[M4root\]/g, '∜');

	str = str.replace(/\[M00\]/g, '∞');
	str = str.replace(/\[MA(r|90)\]/g, '∟');
	str = str.replace(/\[MA(a|45|)\]/g, '∠');
	str = str.replace(/\[M=\?\]/g, '≈');

	//todo: add ability for optional math symbols with escaped html

	return str;
}


function autoCloseTags(str){

	//todo: replace function

	if(!str && str !== 0 && str !== false){return null;}

	str += '?>';

	str = escapeInvalidTags(str);

	if(!singleTagsList || singleTagsList.length < 1){return str.toString();}

	const skipTagsList = singleTagsList.join('|');

	let tagOpenings = [];

	let tagRegex = new RegExp('(<\/?(?![^A-Za-z0-9_\-]|\!DOCTYPE|'+skipTagsList+')(?:(?:\\s+?[^>]*?)|)>)', 'gsi');
	if(!safeRegex(tagRegex)){return str.toString();}

	str = str.split(tagRegex).map(tag => {
		if(tag.match(tagRegex)){
			let tagName = tag.replace(/<\/?([A-Za-z0-9_-]+).*?>/gsi, '$1');
			if(tag.startsWith('</')){
				if(tagOpenings.length <= 0){
					return '';
				}else if(tagOpenings[tagOpenings.length-1] === tagName){
					tagOpenings.pop();
					return '</'+tagName+'>';
				}else{
					let closeTags = '';
					while(tagOpenings.length > 0 && tagOpenings[tagOpenings.length-1] !== tagName){
						closeTags += '</'+tagOpenings[tagOpenings.length-1]+'>';
						tagOpenings.pop();
					}
					return closeTags;
				}
			}else{
				tagOpenings.push(tagName);
			}
		}
		return tag;
	});
	while(tagOpenings.length > 0){
		str.push('</'+tagOpenings[tagOpenings.length-1]+'>');
		tagOpenings.pop();
	}
	str = str.join('');

	return str.toString();
}


function defineSingleTagType(name){
	if(!name || typeof name !== 'string' || name.trim() === ''){return null;}
	if(!singleTagsList.includes(name)){singleTagsList.push(name);}
	return true;
}


function escapeInvalidTags(str){if(!str && str !== 0 && str !== false){return null;} return str.toString().replace(/<\/?([A-Za-z0-9_-]+)([^>]+)(<|.$)/gsi, '&lt;$1$2$3');}
function stripInvalidTags(str){if(!str && str !== 0 && str !== false){return null;} return str.toString().replace(/<\/?([A-Za-z0-9_-]+)([^>]+)(<|.$)/gsi, '$2$3');}

function escapeHtml(str){
	if(!str && str !== 0 && str !== false){return null;}
	return str.toString().replace(/&(?!(amp|gt|lt|lbrace|rbrace|sol|bsol|quest|equals|lbrack|rbrack|lpar|rpar|vert|num|sect|ast|comma|period|grave|apos|quot);)/g, '&amp;')
	.replace(/</g, '&lt;').replace(/>/g, '&gt;')
	.replace(/{/g, '&lbrace;').replace(/}/g, '&rbrace;')
	.replace(/\//g, '&sol;').replace(/\\/g, '&bsol;')
	.replace(/\?/g, '&quest;').replace(/=/g, '&equals;')
	.replace(/\[/g, '&lbrack;').replace(/\]/g, '&rbrack;')
	.replace(/\(/g, '&lpar;').replace(/\)/g, '&rpar;')
	.replace(/\|/g, '&vert;').replace(/#/g, '&num;')
	.replace(/§/g, '&sect;').replace(/\*/g, '&ast;')
	.replace(/,/g, '&comma;').replace(/\./g, '&period;')
	.replace(/`/g, '&grave;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
}
function unescapeHtml(str){
	if(!str && str !== 0 && str !== false){return null;}
	return str.toString().replace(/&amp;/g, '&')
	.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
	.replace(/&lbrace;/g, '{').replace(/&rbrace;/g, '}')
	.replace(/&sol;/g, '/').replace(/&bsol;/g, '\\')
	.replace(/&quest;/g, '?').replace(/&equals;/g, '=')
	.replace(/&lbrack;/g, '[').replace(/&rbrack;/g, ']')
	.replace(/&lpar;/g, '(').replace(/&rpar;/g, ')')
	.replace(/&vert;/g, '|').replace(/&num;/g, '#')
	.replace(/&sect;/g, '§').replace(/&ast;/g, '*')
	.replace(/&comma;/g, ',').replace(/&period;/g, '.')
	.replace(/&grave;/g, '`').replace(/&apos;/g, '\'').replace(/&quot;/g, '"');
}

function escapeRegex(str){return str.replace(/([.*+?^${}()|[\]\\])/g, '\\$1');}

function normalizeJson(str){
	return str.replace(/[\s\n\r\t]/gs, '').replace(/,([}\]])/gs, '$1')
	.replace(/([,{\[]|)(?:("|'|)([\w_\- ]+)\2:|)("|'|)(.*?)\4([,}\]])/gs, (str, start, q1, index, q2, item, end) => {
		item = item.replace(/"/gsi, '').trim();
		if(index){index = '"'+index.replace(/"/gsi, '').trim()+'"';}
		if(!item.match(/^[0-9]+(\.[0-9]+|)$/) && !['true','false'].includes(item)){item = '"'+item+'"';}
		if(index){return start+index+':'+item+end;}
		return start+item+end;
	});
}


function forEach(obj, callback){
	if(obj && ['string', 'number'].includes(typeof obj)){obj = [obj];}
	if(obj && typeof obj === 'object'){
		let keys = Object.keys(obj);
		for(let i = 0; i < keys.length; i++){
			callback(obj[keys[i]], keys[i], obj);
		}
	}else if(obj && Array.isArray(obj)){
		for(let i = 0; i < obj.length; i++){
			callback(obj[i], i, obj);
		}
	}
}

function getObj(path, obj){
	if(!obj || !path || (typeof obj !== 'object' && !Array.isArray(obj)) || (typeof path !== 'string' && typeof path !== 'number' && typeof path !== 'boolean')){return null;}
	path = path.split(/(?:\.|\[([^\]]+)\])/gs).filter(str => str && str.trim() !== '');
	function findVarInObj(object, property){if(property && typeof object === 'object' && typeof object[property] !== 'undefined'){return object[property];} return undefined;}
	return path.reduce(findVarInObj, obj);
}


module.exports = (function(){
	let exports = function(options = undefined){
		if(typeof options === 'object'){
			Object.assign(mainOptions, options);
			if(options.cacheDev || options.cacheDev === false){memoryCache.cacheDevelopment(options.cacheDev);}
		}return engine;
	};
	exports.render = render;
	exports.addFunction = addTagFunction;
	exports.defineSingleTagType = defineSingleTagType;
	exports.customMarkdown = customMarkdown;
	exports.escapeHtml = escapeHtml;
	exports.unescapeHtml = unescapeHtml;
	exports.escapeInvalidTags = escapeInvalidTags;
	exports.stripInvalidTags = stripInvalidTags;
	exports.escapeRegex = escapeRegex;
	exports.normalizeJson = normalizeJson;
	exports.forEach = forEach;
	exports.getObj = getObj;
	exports.autoCloseTags = autoCloseTags;
	return exports;
})();
