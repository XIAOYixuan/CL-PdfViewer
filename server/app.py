import json
import logging
import os
import time
from pathlib import Path

import openai
from create_index import create_index
from gp4_wrapper import DialogManager 
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS
from llama_index import (
    GPTListIndex,
    GPTSimpleVectorIndex,
    MockEmbedding,
    MockLLMPredictor,
    ServiceContext,
    download_loader,
)
from llama_index.optimization.optimizer import SentenceEmbeddingOptimizer

#openai_proxy = os.environ.get("OPENAI_PROXY", "https://api.openai.com/v1")
#openai.api_base = openai_proxy


staticPath = "static"

if not os.path.exists(f"{staticPath}/file"):
    os.makedirs(f"{staticPath}/file")
if not os.path.exists(f"{staticPath}/index"):
    os.makedirs(f"{staticPath}/index")
if not os.path.exists(f"{staticPath}/temp"):
    os.makedirs(f"{staticPath}/temp")
if not os.path.exists(f"logs"):
    os.makedirs(f"logs")


app = Flask(__name__, static_folder=f"{staticPath}")


CORS(app)

logger = logging.getLogger(__name__)
file_handler = logging.FileHandler("logs/app.log", encoding="utf-8")
formatter = logging.Formatter(
    "%(asctime)s %(levelname)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
)
file_handler.setFormatter(formatter)
file_handler.setLevel(logging.ERROR)
logger.addHandler(file_handler)

load_dotenv()


@app.errorhandler(Exception)
def handle_error(error):
    """全局错误处理"""
    message = str(error)
    status_code = 500
    if hasattr(error, "status_code"):
        status_code = error.status_code
    print("some error:", error)
    response = jsonify({"message": message})
    response.status_code = status_code
    logger.error(error, exc_info=True)
    return response


@app.route("/api/summarize", methods=["GET"])
def summarize_index():
    file = request.args.get("file")
    open_ai_key = request.args.get("openAiKey")
    if open_ai_key:
        os.environ["OPENAI_API_KEY"] = open_ai_key

    UnstructuredReader = download_loader("UnstructuredReader")
    loader = UnstructuredReader()
    documents = loader.load_data(file=Path(f"./{staticPath}/file/{file}"))
    index = GPTListIndex.from_documents(documents)

    # predictor cost
    llm_predictor = MockLLMPredictor(max_tokens=256)
    embed_model = MockEmbedding(embed_dim=1536)
    service_context = ServiceContext.from_defaults(
        llm_predictor=llm_predictor, embed_model=embed_model
    )

    # TODO: Format everything as markdown
    prompt = f"""
        Summarize this document and provide three questions related to the summary. Try to use your own words when possible. Keep your answer under 5 sentences. 

        Use the following format:
        <summary text>


        Questions you may want to ask 🤔
        1. <question text>
        2. <question text>
        3. <question text>
        """

    index.query(
        prompt,
        response_mode="tree_summarize",
        service_context=service_context,
        optimizer=SentenceEmbeddingOptimizer(percentile_cutoff=0.8),
    )

    res = index.query(
        prompt,
        streaming=True,
        response_mode="tree_summarize",
        optimizer=SentenceEmbeddingOptimizer(percentile_cutoff=0.8),
    )
    cost = embed_model.last_token_usage + llm_predictor.last_token_usage

    def response_generator():
        yield json.dumps({"cost": cost, "sources": []})
        yield "\n ###endjson### \n\n"
        for text in res.response_gen:
            yield text

    # 用完了就删掉，防止key被反复使用
    if open_ai_key:
        os.environ["OPENAI_API_KEY"] = ""

    return Response(stream_with_context(response_generator()))

# Edit by Yixuan
#TODO: storing the DialogHistoryManager for each index might not be scalable, 
# here we assume it's for single user, so we can use a global variable 
# to store the history for each index
#TODO: reset the dataase when user delete the pdf file
id2chatbot = {}
@app.route("/api/query", methods=["GET"])
def query_index():
    # the current prompt text, it would be concatenated with the history
    query_text = request.args.get("query") 
    # the pdf file name, currently we assume index is unique
    # there's no duplicate file name
    index_name = request.args.get("index") 
    open_ai_key = request.args.get("openAiKey")
    major = "Linguistics"

    # for debug
    print("-------- query text: ", query_text)
    print("-------- index name: ", index_name)
    print("-------- open ai key: ", open_ai_key)
    if open_ai_key:
        os.environ["OPENAI_API_KEY"] = open_ai_key
        openai.api_key = os.getenv("OPENAI_API_KEY")
    else:
        openai.api_key = ""

    if index_name not in id2chatbot:
        chatbot = DialogManager(file_path=f"{staticPath}/db/{index_name}.db",
                                major=major)
        id2chatbot[index_name] = chatbot
    else:
        chatbot = id2chatbot[index_name]

    response = chatbot.get_response(query=query_text, 
                                    major=major)
    #response = chatbot.debug(query_text, "explain")

    # stream api response config
    delay_time = 0.01
    
    def response_gen():
        yield json.dumps({"cost": 0, "sources": ""})
        yield "\n ###endjson### \n\n"
        full_text = ""
        for event in response:
            event_text = event["choices"][0]["delta"]
            answer = event_text.get("content", "")
            time.sleep(delay_time)
            full_text += answer
            yield answer
        chatbot.collect_response(full_text)

    if open_ai_key:
        os.environ["OPENAI_API_KEY"] = ""

    return Response(stream_with_context(response_gen()))

# Edit by Yixuan
# Upload the file locally and create the index
# The original code would create them via another indexing model for text
# sumaarization, which is not in use in our project, so we delete it.
# However, at the client side, we still need the json file to generate the 
# file list for the side menu. 
@app.route("/api/upload", methods=["POST"])
def upload_file():
    filepath = None
    try:
        open_ai_key = request.form["openAiKey"]
        if open_ai_key:
            os.environ["OPENAI_API_KEY"] = open_ai_key

        uploaded_file = request.files["file"]
        filename = uploaded_file.filename
        print(os.getcwd(), os.path.abspath(__file__))
        filepath = os.path.join(f"{staticPath}/temp", os.path.basename(filename))
        uploaded_file.save(filepath)

        token_usage = create_index(filepath, filename)
        #print(type(token_usage))
        token_usage = 0
    except Exception as e:
        logger.error(e, exc_info=True)
        # cleanup temp file
        print(e, "upload error")
        if filepath is not None and os.path.exists(filepath):
            os.remove(filepath)

        # 用完了就删掉，防止key被反复使用
        if open_ai_key:
            os.environ["OPENAI_API_KEY"] = ""
        return "Error: {}".format(str(e)), 500

    # cleanup temp file
    if filepath is not None and os.path.exists(filepath):
        os.remove(filepath)

    # 用完了就删掉，防止key被反复使用
    if open_ai_key:
        os.environ["OPENAI_API_KEY"] = ""

    return jsonify(token_usage), 200


@app.route("/api/index-list", methods=["GET"])
def get_index_files():
    dir = f"{staticPath}/index"
    files = os.listdir(dir)
    return files


@app.route("/api/file-list", methods=["GET"])
def get_html_files():
    dir = f"{staticPath}/file"
    files = os.listdir(dir)
    file_list = [
        {
            "path": f"/{dir}/{file}",
            "name": os.path.splitext(file)[0],
            "ext": os.path.splitext(file)[1],
            "fullName": file,
        }
        for file in files
    ]

    return sorted(file_list, key=lambda x: x["name"].lower())


if __name__ == "__main__":
    app.run()
