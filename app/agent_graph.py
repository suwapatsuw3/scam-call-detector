from typing import TypedDict, Literal, List
from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate
from app.config import AGENT_CONFIG
from app.models import get_models

# Define State
class AgentState(TypedDict):
    new_chunk: str
    analysis_text: str
    recent_messages: List[str]
    suspicious_history: List[str]
    status: Literal["SCAM", "SAFE", "WAIT"]
    confidence: float
    reason: str

# Helper Functions
def build_context(recent, suspicious, new_text):
    parts = []
    if suspicious:
        parts.append("[สัญญาณก่อนหน้า] " + " | ".join(suspicious))
    if recent:
        parts.append("[บทสนทนาล่าสุด] " + " ".join(recent))
    parts.append(new_text)
    return " ".join(parts)

# Nodes
def detector_node(state: AgentState):
    models = get_models()
    recent = state.get("recent_messages", [])
    suspicious = state.get("suspicious_history", [])
    new_text = state["new_chunk"]
    
    text_to_analyze = build_context(recent, suspicious, new_text)
    
    # Run Classification
    result = models.scam_classifier(text_to_analyze)[0]
    score = result['score']
    label = result['label']
    
    pred_class = "SCAM" if label in ["SCAM", "LABEL_1"] else "SAFE"
    final_status = "WAIT" if score < 0.7 else pred_class
    
    return {
        "status": final_status,
        "confidence": score,
        "analysis_text": text_to_analyze,
        "new_chunk": new_text
    }

def memory_manager_node(state: AgentState):
    status = state["status"]
    confidence = state["confidence"]
    new_text = state["new_chunk"]
    
    recent = state.get("recent_messages", []).copy()
    suspicious = state.get("suspicious_history", []).copy()
    
    # Update Sliding Window
    recent.append(new_text)
    if len(recent) > AGENT_CONFIG["SLIDING_WINDOW_SIZE"]:
        recent.pop(0)
    
    # Store Suspicious
    if confidence > AGENT_CONFIG["SUSPICIOUS_THRESHOLD"] and status in ["WAIT", "SCAM"]:
        if new_text not in suspicious:
            suspicious.append(new_text)
            if len(suspicious) > AGENT_CONFIG["MAX_SUSPICIOUS_KEEP"]:
                suspicious.pop(0)
                
    if status == "SAFE":
        suspicious = [] # Clear if safe
        
    return {"recent_messages": recent, "suspicious_history": suspicious}

def explainer_node(state: AgentState):
    models = get_models()
    prompt = ChatPromptTemplate.from_messages([
        ("system", "หน้าที่ของคุณคือระบบแจ้งเตือนความปลอดภัย (Security Alert)"),
        ("user", """วิเคราะห์ข้อความต่อไปนี้ แล้วอธิบายสั้นๆ ว่า "ทำไมถึงเป็นมิจฉาชีพ?"
        ตอบเป็นภาษาไทย ความยาวไม่เกิน 2 บรรทัด
        ข้อความ: "{context}"
        คำอธิบาย:""")
    ])
    chain = prompt | models.explainer_llm
    response = chain.invoke({"context": state["analysis_text"]})
    return {"reason": response.content.strip()}

def router(state: AgentState):
    return "explainer" if state["status"] == "SCAM" else END

# Build Graph
def build_agent():
    workflow = StateGraph(AgentState)
    workflow.add_node("detector", detector_node)
    workflow.add_node("memory_manager", memory_manager_node)
    workflow.add_node("explainer", explainer_node)
    
    workflow.set_entry_point("detector")
    workflow.add_edge("detector", "memory_manager")
    workflow.add_conditional_edges("memory_manager", router, {"explainer": "explainer", END: END})
    workflow.add_edge("explainer", END)
    
    return workflow.compile()

agent_app = build_agent()
