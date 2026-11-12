from sqlalchemy import Column, Integer, String, Text, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class AnalysisReport(Base):
    __tablename__ = "analysis_reports"

    id = Column(Integer, primary_key=True, index=True)
    extension_name = Column(String, index=True)
    status = Column(String)

class NetworkLog(Base):
    __tablename__ = "network_logs"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("analysis_reports.id"))
    url = Column(String)
    method = Column(String)
    resource_type = Column(String)

class BehaviorLog(Base):
    __tablename__ = "behavior_logs"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("analysis_reports.id"))
    details = Column(Text)