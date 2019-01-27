(function(global)
{"use strict";var IS_WORKER=!global.document,LOADED_SYNC=false,AUTO_SCRIPT_PATH;var workers={},workerIdCounter=0;global.Papa={};global.Papa.parse=CsvToJson;global.Papa.unparse=JsonToCsv;global.Papa.RECORD_SEP=String.fromCharCode(30);global.Papa.UNIT_SEP=String.fromCharCode(31);global.Papa.BYTE_ORDER_MARK="\ufeff";global.Papa.BAD_DELIMITERS=["\r","\n","\"",global.Papa.BYTE_ORDER_MARK];global.Papa.WORKERS_SUPPORTED=!!global.Worker;global.Papa.SCRIPT_PATH=null;global.Papa.LocalChunkSize=1024*1024*10;global.Papa.RemoteChunkSize=1024*1024*5;global.Papa.DefaultDelimiter=",";global.Papa.Parser=Parser;global.Papa.ParserHandle=ParserHandle;global.Papa.NetworkStreamer=NetworkStreamer;global.Papa.FileStreamer=FileStreamer;global.Papa.StringStreamer=StringStreamer;if(global.jQuery)
{var $=global.jQuery;$.fn.parse=function(options)
{var config=options.config||{};var queue=[];this.each(function(idx)
{var supported=$(this).prop('tagName').toUpperCase()=="INPUT"&&$(this).attr('type').toLowerCase()=="file"&&global.FileReader;if(!supported||!this.files||this.files.length==0)
return true;for(var i=0;i<this.files.length;i++)
{queue.push({file:this.files[i],inputElem:this,instanceConfig:$.extend({},config)});}});parseNextFile();return this;function parseNextFile()
{if(queue.length==0)
{if(isFunction(options.complete))
options.complete();return;}
var f=queue[0];if(isFunction(options.before))
{var returned=options.before(f.file,f.inputElem);if(typeof returned==='object')
{if(returned.action=="abort")
{error("AbortError",f.file,f.inputElem,returned.reason);return;}
else if(returned.action=="skip")
{fileComplete();return;}
else if(typeof returned.config==='object')
f.instanceConfig=$.extend(f.instanceConfig,returned.config);}
else if(returned=="skip")
{fileComplete();return;}}
var userCompleteFunc=f.instanceConfig.complete;f.instanceConfig.complete=function(results)
{if(isFunction(userCompleteFunc))
userCompleteFunc(results,f.file,f.inputElem);fileComplete();};Papa.parse(f.file,f.instanceConfig);}
function error(name,file,elem,reason)
{if(isFunction(options.error))
options.error({name:name},file,elem,reason);}
function fileComplete()
{queue.splice(0,1);parseNextFile();}}}
if(IS_WORKER)
{global.onmessage=workerThreadReceivedMessage;}
else if(Papa.WORKERS_SUPPORTED)
{AUTO_SCRIPT_PATH=getScriptPath();if(!document.body)
{LOADED_SYNC=true;}
else
{document.addEventListener('DOMContentLoaded',function(){LOADED_SYNC=true;},true);}}
function CsvToJson(_input,_config)
{_config=_config||{};if(_config.worker&&Papa.WORKERS_SUPPORTED)
{var w=newWorker();w.userStep=_config.step;w.userChunk=_config.chunk;w.userComplete=_config.complete;w.userError=_config.error;_config.step=isFunction(_config.step);_config.chunk=isFunction(_config.chunk);_config.complete=isFunction(_config.complete);_config.error=isFunction(_config.error);delete _config.worker;w.postMessage({input:_input,config:_config,workerId:w.id});return;}
var streamer=null;if(typeof _input==='string')
{if(_config.download)
streamer=new NetworkStreamer(_config);else
streamer=new StringStreamer(_config);}
else if((global.File&&_input instanceof File)||_input instanceof Object)
streamer=new FileStreamer(_config);return streamer.stream(_input);}
function JsonToCsv(_input,_config)
{var _output="";var _fields=[];var _quotes=false;var _delimiter=",";var _newline="\r\n";unpackConfig();if(typeof _input==='string')
_input=JSON.parse(_input);if(_input instanceof Array)
{if(!_input.length||_input[0]instanceof Array)
return serialize(null,_input);else if(typeof _input[0]==='object')
return serialize(objectKeys(_input[0]),_input);}
else if(typeof _input==='object')
{if(typeof _input.data==='string')
_input.data=JSON.parse(_input.data);if(_input.data instanceof Array)
{if(!_input.fields)
_input.fields=_input.data[0]instanceof Array?_input.fields:objectKeys(_input.data[0]);if(!(_input.data[0]instanceof Array)&&typeof _input.data[0]!=='object')
_input.data=[_input.data];}
return serialize(_input.fields||[],_input.data||[]);}
throw"exception: Unable to serialize unrecognized input";function unpackConfig()
{if(typeof _config!=='object')
return;if(typeof _config.delimiter==='string'&&_config.delimiter.length==1&&global.Papa.BAD_DELIMITERS.indexOf(_config.delimiter)==-1)
{_delimiter=_config.delimiter;}
if(typeof _config.quotes==='boolean'||_config.quotes instanceof Array)
_quotes=_config.quotes;if(typeof _config.newline==='string')
_newline=_config.newline;}
function objectKeys(obj)
{if(typeof obj!=='object')
return[];var keys=[];for(var key in obj)
keys.push(key);return keys;}
function serialize(fields,data)
{var csv="";if(typeof fields==='string')
fields=JSON.parse(fields);if(typeof data==='string')
data=JSON.parse(data);var hasHeader=fields instanceof Array&&fields.length>0;var dataKeyedByField=!(data[0]instanceof Array);if(hasHeader)
{for(var i=0;i<fields.length;i++)
{if(i>0)
csv+=_delimiter;csv+=safe(fields[i],i);}
if(data.length>0)
csv+=_newline;}
for(var row=0;row<data.length;row++)
{var maxCol=hasHeader?fields.length:data[row].length;for(var col=0;col<maxCol;col++)
{if(col>0)
csv+=_delimiter;var colIdx=hasHeader&&dataKeyedByField?fields[col]:col;csv+=safe(data[row][colIdx],col);}
if(row<data.length-1)
csv+=_newline;}
return csv;}
function safe(str,col)
{if(typeof str==="undefined"||str===null)
return"";str=str.toString().replace(/"/g,'""');var needsQuotes=(typeof _quotes==='boolean'&&_quotes)||(_quotes instanceof Array&&_quotes[col])||hasAny(str,global.Papa.BAD_DELIMITERS)||str.indexOf(_delimiter)>-1||str.charAt(0)==' '||str.charAt(str.length-1)==' ';return needsQuotes?'"'+str+'"':str;}
function hasAny(str,substrings)
{for(var i=0;i<substrings.length;i++)
if(str.indexOf(substrings[i])>-1)
return true;return false;}}
function ChunkStreamer(config)
{this._handle=null;this._paused=false;this._finished=false;this._input=null;this._baseIndex=0;this._partialLine="";this._rowCount=0;this._start=0;this._nextChunk=null;replaceConfig.call(this,config);this.parseChunk=function(chunk)
{var aggregate=this._partialLine+chunk;this._partialLine="";var results=this._handle.parse(aggregate,this._baseIndex,!this._finished);if(this._handle.paused())
return;var lastIndex=results.meta.cursor;if(!this._finished)
{this._partialLine=aggregate.substring(lastIndex-this._baseIndex);this._baseIndex=lastIndex;}
if(results&&results.data)
this._rowCount+=results.data.length;var finishedIncludingPreview=this._finished||(this._config.preview&&this._rowCount>=this._config.preview);if(IS_WORKER)
{global.postMessage({results:results,workerId:Papa.WORKER_ID,finished:finishedIncludingPreview});}
else if(isFunction(this._config.chunk))
{this._config.chunk(results,this._handle);if(this._paused)
return;results=undefined;}
if(finishedIncludingPreview&&isFunction(this._config.complete)&&(!results||!results.meta.aborted))
this._config.complete(results);if(!finishedIncludingPreview&&(!results||!results.meta.paused))
this._nextChunk();return results;};this._sendError=function(error)
{if(isFunction(this._config.error))
this._config.error(error);else if(IS_WORKER&&this._config.error)
{global.postMessage({workerId:Papa.WORKER_ID,error:error,finished:false});}};function replaceConfig(config)
{var configCopy=copy(config);configCopy.chunkSize=parseInt(configCopy.chunkSize);this._handle=new ParserHandle(configCopy);this._handle.streamer=this;this._config=configCopy;}}
function NetworkStreamer(config)
{config=config||{};if(!config.chunkSize)
config.chunkSize=Papa.RemoteChunkSize;ChunkStreamer.call(this,config);var xhr;if(IS_WORKER)
{this._nextChunk=function()
{this._readChunk();this._chunkLoaded();};}
else
{this._nextChunk=function()
{this._readChunk();};}
this.stream=function(url)
{this._input=url;this._nextChunk();};this._readChunk=function()
{if(this._finished)
{this._chunkLoaded();return;}
xhr=new XMLHttpRequest();if(!IS_WORKER)
{xhr.onload=bindFunction(this._chunkLoaded,this);xhr.onerror=bindFunction(this._chunkError,this);}
xhr.open("GET",this._input,!IS_WORKER);if(this._config.step||this._config.chunk)
{var end=this._start+this._config.chunkSize-1;xhr.setRequestHeader("Range","bytes="+this._start+"-"+end);xhr.setRequestHeader("If-None-Match","webkit-no-cache");}
try{xhr.send();}
catch(err){this._chunkError(err.message);}
if(IS_WORKER&&xhr.status==0)
this._chunkError();else
this._start+=this._config.chunkSize;}
this._chunkLoaded=function()
{if(xhr.readyState!=4)
return;if(xhr.status<200||xhr.status>=400)
{this._chunkError();return;}
this._finished=(!this._config.step&&!this._config.chunk)||this._start>getFileSize(xhr);this.parseChunk(xhr.responseText);}
this._chunkError=function(errorMessage)
{var errorText=xhr.statusText||errorMessage;this._sendError(errorText);}
function getFileSize(xhr)
{var contentRange=xhr.getResponseHeader("Content-Range");return parseInt(contentRange.substr(contentRange.lastIndexOf("/")+1));}}
NetworkStreamer.prototype=Object.create(ChunkStreamer.prototype);NetworkStreamer.prototype.constructor=NetworkStreamer;function FileStreamer(config)
{config=config||{};if(!config.chunkSize)
config.chunkSize=Papa.LocalChunkSize;ChunkStreamer.call(this,config);var reader,slice;var usingAsyncReader=typeof FileReader!=='undefined';this.stream=function(file)
{this._input=file;slice=file.slice||file.webkitSlice||file.mozSlice;if(usingAsyncReader)
{reader=new FileReader();reader.onload=bindFunction(this._chunkLoaded,this);reader.onerror=bindFunction(this._chunkError,this);}
else
reader=new FileReaderSync();this._nextChunk();};this._nextChunk=function()
{if(!this._finished&&(!this._config.preview||this._rowCount<this._config.preview))
this._readChunk();}
this._readChunk=function()
{var end=Math.min(this._start+this._config.chunkSize,this._input.size);var txt=reader.readAsText(slice.call(this._input,this._start,end),this._config.encoding);if(!usingAsyncReader)
this._chunkLoaded({target:{result:txt}});}
this._chunkLoaded=function(event)
{this._start+=this._config.chunkSize;this._finished=this._start>=this._input.size;this.parseChunk(event.target.result);}
this._chunkError=function()
{this._sendError(reader.error);}}
FileStreamer.prototype=Object.create(ChunkStreamer.prototype);FileStreamer.prototype.constructor=FileStreamer;function StringStreamer(config)
{config=config||{};ChunkStreamer.call(this,config);var string;var remaining;this.stream=function(s)
{string=s;remaining=s;return this._nextChunk();}
this._nextChunk=function()
{if(this._finished)return;var size=this._config.chunkSize;var chunk=size?remaining.substr(0,size):remaining;remaining=size?remaining.substr(size):'';this._finished=!remaining;return this.parseChunk(chunk);}}
StringStreamer.prototype=Object.create(StringStreamer.prototype);StringStreamer.prototype.constructor=StringStreamer;function ParserHandle(_config)
{var FLOAT=/^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i;var self=this;var _stepCounter=0;var _input;var _parser;var _paused=false;var _delimiterError;var _fields=[];var _results={data:[],errors:[],meta:{}};if(isFunction(_config.step))
{var userStep=_config.step;_config.step=function(results)
{_results=results;if(needsHeaderRow())
processResults();else
{processResults();if(_results.data.length==0)
return;_stepCounter+=results.data.length;if(_config.preview&&_stepCounter>_config.preview)
_parser.abort();else
userStep(_results,self);}};}
this.parse=function(input,baseIndex,ignoreLastRow)
{if(!_config.newline)
_config.newline=guessLineEndings(input);_delimiterError=false;if(!_config.delimiter)
{var delimGuess=guessDelimiter(input);if(delimGuess.successful)
_config.delimiter=delimGuess.bestDelimiter;else
{_delimiterError=true;_config.delimiter=Papa.DefaultDelimiter;}
_results.meta.delimiter=_config.delimiter;}
var parserConfig=copy(_config);if(_config.preview&&_config.header)
parserConfig.preview++;_input=input;_parser=new Parser(parserConfig);_results=_parser.parse(_input,baseIndex,ignoreLastRow);processResults();return _paused?{meta:{paused:true}}:(_results||{meta:{paused:false}});};this.paused=function()
{return _paused;};this.pause=function()
{_paused=true;_parser.abort();_input=_input.substr(_parser.getCharIndex());};this.resume=function()
{_paused=false;self.streamer.parseChunk(_input);};this.abort=function()
{_parser.abort();if(isFunction(_config.complete))
_config.complete(_results);_input="";};function processResults()
{if(_results&&_delimiterError)
{addError("Delimiter","UndetectableDelimiter","Unable to auto-detect delimiting character; defaulted to '"+Papa.DefaultDelimiter+"'");_delimiterError=false;}
if(_config.skipEmptyLines)
{for(var i=0;i<_results.data.length;i++)
if(_results.data[i].length==1&&_results.data[i][0]=="")
_results.data.splice(i--,1);}
if(needsHeaderRow())
fillHeaderFields();return applyHeaderAndDynamicTyping();}
function needsHeaderRow()
{return _config.header&&_fields.length==0;}
function fillHeaderFields()
{if(!_results)
return;for(var i=0;needsHeaderRow()&&i<_results.data.length;i++)
for(var j=0;j<_results.data[i].length;j++)
_fields.push(_results.data[i][j]);_results.data.splice(0,1);}
function applyHeaderAndDynamicTyping()
{if(!_results||(!_config.header&&!_config.dynamicTyping))
return _results;for(var i=0;i<_results.data.length;i++)
{var row={};for(var j=0;j<_results.data[i].length;j++)
{if(_config.dynamicTyping)
{var value=_results.data[i][j];if(value=="true")
_results.data[i][j]=true;else if(value=="false")
_results.data[i][j]=false;else
_results.data[i][j]=tryParseFloat(value);}
if(_config.header)
{if(j>=_fields.length)
{if(!row["__parsed_extra"])
row["__parsed_extra"]=[];row["__parsed_extra"].push(_results.data[i][j]);}
else
row[_fields[j]]=_results.data[i][j];}}
if(_config.header)
{_results.data[i]=row;if(j>_fields.length)
addError("FieldMismatch","TooManyFields","Too many fields: expected "+_fields.length+" fields but parsed "+j,i);else if(j<_fields.length)
addError("FieldMismatch","TooFewFields","Too few fields: expected "+_fields.length+" fields but parsed "+j,i);}}
if(_config.header&&_results.meta)
_results.meta.fields=_fields;return _results;}
function guessDelimiter(input)
{var delimChoices=[",","\t","|",";",Papa.RECORD_SEP,Papa.UNIT_SEP];var bestDelim,bestDelta,fieldCountPrevRow;for(var i=0;i<delimChoices.length;i++)
{var delim=delimChoices[i];var delta=0,avgFieldCount=0;fieldCountPrevRow=undefined;var preview=new Parser({delimiter:delim,preview:10}).parse(input);for(var j=0;j<preview.data.length;j++)
{var fieldCount=preview.data[j].length;avgFieldCount+=fieldCount;if(typeof fieldCountPrevRow==='undefined')
{fieldCountPrevRow=fieldCount;continue;}
else if(fieldCount>1)
{delta+=Math.abs(fieldCount-fieldCountPrevRow);fieldCountPrevRow=fieldCount;}}
avgFieldCount/=preview.data.length;if((typeof bestDelta==='undefined'||delta<bestDelta)&&avgFieldCount>1.99)
{bestDelta=delta;bestDelim=delim;}}
_config.delimiter=bestDelim;return{successful:!!bestDelim,bestDelimiter:bestDelim}}
function guessLineEndings(input)
{input=input.substr(0,1024*1024);var r=input.split('\r');if(r.length==1)
return'\n';var numWithN=0;for(var i=0;i<r.length;i++)
{if(r[i][0]=='\n')
numWithN++;}
return numWithN>=r.length/2?'\r\n':'\r';}
function tryParseFloat(val)
{var isNumber=FLOAT.test(val);return isNumber?parseFloat(val):val;}
function addError(type,code,msg,row)
{_results.errors.push({type:type,code:code,message:msg,row:row});}}
function Parser(config)
{config=config||{};var delim=config.delimiter;var newline=config.newline;var comments=config.comments;var step=config.step;var preview=config.preview;var fastMode=config.fastMode;if(typeof delim!=='string'||delim.length!=1||Papa.BAD_DELIMITERS.indexOf(delim)>-1)
delim=",";if(comments===delim)
throw"Comment character same as delimiter";else if(comments===true)
comments="#";else if(typeof comments!=='string'||Papa.BAD_DELIMITERS.indexOf(comments)>-1)
comments=false;if(newline!='\n'&&newline!='\r'&&newline!='\r\n')
newline='\n';var cursor=0;var aborted=false;this.parse=function(input,baseIndex,ignoreLastRow)
{if(typeof input!=='string')
throw"Input must be a string";var inputLen=input.length,delimLen=delim.length,newlineLen=newline.length,commentsLen=comments.length;var stepIsFunction=typeof step==='function';cursor=0;var data=[],errors=[],row=[],lastCursor=0;if(!input)
return returnable();if(fastMode||(fastMode!==false&&input.indexOf('"')===-1))
{var rows=input.split(newline);for(var i=0;i<rows.length;i++)
{var row=rows[i];cursor+=row.length;if(i!==rows.length-1)
cursor+=newline.length;else if(ignoreLastRow)
return returnable();if(comments&&row.substr(0,commentsLen)==comments)
continue;if(stepIsFunction)
{data=[];pushRow(row.split(delim));doStep();if(aborted)
return returnable();}
else
pushRow(row.split(delim));if(preview&&i>=preview)
{data=data.slice(0,preview);return returnable(true);}}
return returnable();}
var nextDelim=input.indexOf(delim,cursor);var nextNewline=input.indexOf(newline,cursor);for(;;)
{if(input[cursor]=='"')
{var quoteSearch=cursor;cursor++;for(;;)
{var quoteSearch=input.indexOf('"',quoteSearch+1);if(quoteSearch===-1)
{if(!ignoreLastRow){errors.push({type:"Quotes",code:"MissingQuotes",message:"Quoted field unterminated",row:data.length,index:cursor});}
return finish();}
if(quoteSearch===inputLen-1)
{var value=input.substring(cursor,quoteSearch).replace(/""/g,'"');return finish(value);}
if(input[quoteSearch+1]=='"')
{quoteSearch++;continue;}
if(input[quoteSearch+1]==delim)
{row.push(input.substring(cursor,quoteSearch).replace(/""/g,'"'));cursor=quoteSearch+1+delimLen;nextDelim=input.indexOf(delim,cursor);nextNewline=input.indexOf(newline,cursor);break;}
if(input.substr(quoteSearch+1,newlineLen)===newline)
{row.push(input.substring(cursor,quoteSearch).replace(/""/g,'"'));saveRow(quoteSearch+1+newlineLen);nextDelim=input.indexOf(delim,cursor);if(stepIsFunction)
{doStep();if(aborted)
return returnable();}
if(preview&&data.length>=preview)
return returnable(true);break;}}
continue;}
if(comments&&row.length===0&&input.substr(cursor,commentsLen)===comments)
{if(nextNewline==-1)
return returnable();cursor=nextNewline+newlineLen;nextNewline=input.indexOf(newline,cursor);nextDelim=input.indexOf(delim,cursor);continue;}
if(nextDelim!==-1&&(nextDelim<nextNewline||nextNewline===-1))
{row.push(input.substring(cursor,nextDelim));cursor=nextDelim+delimLen;nextDelim=input.indexOf(delim,cursor);continue;}
if(nextNewline!==-1)
{row.push(input.substring(cursor,nextNewline));saveRow(nextNewline+newlineLen);if(stepIsFunction)
{doStep();if(aborted)
return returnable();}
if(preview&&data.length>=preview)
return returnable(true);continue;}
break;}
return finish();function pushRow(row)
{data.push(row);lastCursor=cursor;}
function finish(value)
{if(ignoreLastRow)
return returnable();if(!value)
value=input.substr(cursor);row.push(value);cursor=inputLen;pushRow(row);if(stepIsFunction)
doStep();return returnable();}
function saveRow(newCursor)
{cursor=newCursor;pushRow(row);row=[];nextNewline=input.indexOf(newline,cursor);}
function returnable(stopped)
{return{data:data,errors:errors,meta:{delimiter:delim,linebreak:newline,aborted:aborted,truncated:!!stopped,cursor:lastCursor+(baseIndex||0)}};}
function doStep()
{step(returnable());data=[],errors=[];}};this.abort=function()
{aborted=true;};this.getCharIndex=function()
{return cursor;};}
function getScriptPath()
{var scripts=document.getElementsByTagName('script');return scripts.length?scripts[scripts.length-1].src:'';}
function newWorker()
{if(!Papa.WORKERS_SUPPORTED)
return false;if(!LOADED_SYNC&&Papa.SCRIPT_PATH===null)
throw new Error('Script path cannot be determined automatically when Papa Parse is loaded asynchronously. '+'You need to set Papa.SCRIPT_PATH manually.');var w=new global.Worker(Papa.SCRIPT_PATH||AUTO_SCRIPT_PATH);w.onmessage=mainThreadReceivedMessage;w.id=workerIdCounter++;workers[w.id]=w;return w;}
function mainThreadReceivedMessage(e)
{var msg=e.data;var worker=workers[msg.workerId];var aborted=false;if(msg.error)
worker.userError(msg.error,msg.file);else if(msg.results&&msg.results.data)
{var abort=function(){aborted=true;completeWorker(msg.workerId,{data:[],errors:[],meta:{aborted:true}});};var handle={abort:abort,pause:notImplemented,resume:notImplemented};if(isFunction(worker.userStep))
{for(var i=0;i<msg.results.data.length;i++)
{worker.userStep({data:[msg.results.data[i]],errors:msg.results.errors,meta:msg.results.meta},handle);if(aborted)
break;}
delete msg.results;}
else if(isFunction(worker.userChunk))
{worker.userChunk(msg.results,handle,msg.file);delete msg.results;}}
if(msg.finished&&!aborted)
completeWorker(msg.workerId,msg.results);}
function completeWorker(workerId,results){var worker=workers[workerId];if(isFunction(worker.userComplete))
worker.userComplete(results);worker.terminate();delete workers[workerId];}
function notImplemented(){throw"Not implemented.";}
function workerThreadReceivedMessage(e)
{var msg=e.data;if(typeof Papa.WORKER_ID==='undefined'&&msg)
Papa.WORKER_ID=msg.workerId;if(typeof msg.input==='string')
{global.postMessage({workerId:Papa.WORKER_ID,results:Papa.parse(msg.input,msg.config),finished:true});}
else if((global.File&&msg.input instanceof File)||msg.input instanceof Object)
{var results=Papa.parse(msg.input,msg.config);if(results)
global.postMessage({workerId:Papa.WORKER_ID,results:results,finished:true});}}
function copy(obj)
{if(typeof obj!=='object')
return obj;var cpy=obj instanceof Array?[]:{};for(var key in obj)
cpy[key]=copy(obj[key]);return cpy;}
function bindFunction(f,self)
{return function(){f.apply(self,arguments);}}
function isFunction(func)
{return typeof func==='function';}})(this);
