const path = require('path');
const fs = require('fs');

function setTagFunctions(addTagFunction){

	addTagFunction('echo', ['str', 'allow_html'], function(options, attrs, content, func){
		if(typeof attrs.str === 'string'){attrs.str = attrs.str.replace(/&#44;/gs, ',').replace(/&#40;/gs, '(').replace(/&#41;/gs, ')');}
		let result = func.setObject(attrs.str, options, true);
		let allow_html = func.setObject(attrs.allow_html, options);
		if(['string', 'number', 'boolean'].includes(typeof result)){
			result = result.toString();
		}else{result = ''}
		if(allow_html){return result;}
		return func.escapeHtml(result);
	});


	addTagFunction('echo_html', ['str'], function(options, attrs, content, func){
		if(typeof attrs.str === 'string'){attrs.str = attrs.str.replace(/&#44;/gs, ',').replace(/&#40;/gs, '(').replace(/&#41;/gs, ')');}
		let result = func.setObject(attrs.str, options, true);
		if(['string', 'number', 'boolean'].includes(typeof result)){
			result = result.toString();
		}else{result = ''}
		return result;
	});


	addTagFunction('if', ['logic'], {hasContent: true}, function(options, attrs, content, func){
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
				else{result = func.checkIf(str, options);}
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
		if(result){
			return func.runMainFunctions('<?'+content+'?>', options);
		}
		return false;
	});


	addTagFunction('each', ['obj', 'as', 'of', 'from'], {hasContent: true}, function(options, attrs, content, func){
		if(!attrs.obj || !content){return;}
		content = content.toString();
		let objs = attrs.obj.split('&');
		let result = '';
		for(let i = 0; i < objs.length; i++){
			if(attrs.from){options['$temp'][attrs.from.replace('$', '')] = objs[i].split('.').pop();}
			let obj = func.setObject(objs[i], options);
			func.forEach(obj, function(value, index){
				if(attrs.as){options['$temp'][attrs.as.replace('$', '')] = value;}
				if(attrs.of){options['$temp'][attrs.of.replace('$', '')] = index;}
				result += func.runMainFunctions('<? '+content+' ?>', options);
			});
		}
		if(attrs.as){delete options['$temp'][attrs.as.replace('$', '')];}
		if(attrs.of){delete options['$temp'][attrs.of.replace('$', '')];}
		if(attrs.from){delete options['$temp'][attrs.from.replace('$', '')];}
		return result;
	});


	addTagFunction('import', ['path'], function(options, attrs, content, func){
		if(!attrs.path){return;}
		let filePath = attrs.path.toString().trim();
		if(!filePath.endsWith(viewsType)){filePath += viewsType;}
		if(!filePath.startsWith(viewsPath)){filePath = path.join(viewsPath, filePath);}
		else{filePath = path.resolve(filePath);}
		if(!filePath.startsWith(viewsPath)){return;}
		let fileData = func.getFileCache(filePath);
		if(!fileData && fs.existsSync(filePath)){
			fileData = fs.readFileSync(filePath).toString();
			if(!fileData || fileData.trim() === ''){
				func.setFileCache(filePath, false, options);
				return;
			}
			func.setFileCache(filePath, fileData, options);
		}
		if(!fileData || fileData.trim() === ''){return;}
		if(!fileData.startsWith('\n')){fileData = '\n\r'+fileData;}
		if(!fileData.endsWith('\n')){fileData += '\n\r';}
		fileData = func.autoCloseTags(fileData);
		return func.runMainFunctions(fileData, options);
	});


	addTagFunction('setUserVar', ['name', 'value'], function(options, attrs, content, func){
		if(!attrs.name || !attrs.value){return;}
		options['$userVars'][func.setObject(attrs.name, options, true)] = func.setObject(attrs.value, options, true);
	});


	addTagFunction('typeof', ['var', 'literal'], {returnResult: true, noEcho: true}, function(options, attrs, content, func){
		let result;
		let value = func.setObject(attrs.var, options);
		if(attrs.literal){return typeof value;}
		if(typeof value === 'string'){try{value = JSON.parse(value);}catch(e){}}
		if(typeof value === 'string'){
			if(value === '[object Object]'){result = 'object';}
			else if(value === '[array Array]'){result = 'array';}
			else if(value === '[function Function]'){result = 'function';}
			else if(value.match(/^[0-9]+(\.[0-9]+|)$/)){result = 'number';}
			else if(value === 'true' || value === 'false'){result = 'boolean';}
			else if(value === 'undefined'){result = 'undefined';}
			else if(value === 'null'){result = 'null';}
			else{result = 'string';}
		}else if(Array.isArray(value)){
			result = 'array';
		}else{result = typeof value;}
		return '\''+result+'\'';
	});


	addTagFunction('log', function(options, attrs, content, func){
		if(!attrs){return;}
		let logs = [];
		func.forEach(attrs, attr => {
			let value = func.setObject(attr, options);
			logs.push([attr, value]);
		});
		console.log(...logs);
	});

}

module.exports = setTagFunctions;
