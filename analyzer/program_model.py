from dataclasses import dataclass, field


@dataclass
class FunctionCall:
    name: str
    file: str
    line: int
    column: int
    arguments: list[str] = field(default_factory=list)


@dataclass
class VariableAssignment:
    variable: str
    value: str
    file: str
    line: int
    column: int


@dataclass
class MemberAccess:
    expression: str
    file: str
    line: int
    column: int


@dataclass
class FunctionParameter:
    name: str
    function: str
    file: str
    line: int
    column: int


@dataclass
class FunctionDefinition:
    name: str
    file: str
    line: int
    column: int
    parameters: list[str] = field(default_factory=list)


@dataclass
class ProgramModel:
    file: str
    syntax_error: bool = False

    function_definitions: list[FunctionDefinition] = field(
        default_factory=list
    )

    function_calls: list[FunctionCall] = field(
        default_factory=list
    )

    variable_assignments: list[VariableAssignment] = field(
        default_factory=list
    )

    member_access: list[MemberAccess] = field(
        default_factory=list
    )

    function_parameters: list[FunctionParameter] = field(
        default_factory=list
    )

    urls: list[str] = field(
        default_factory=list
    )


def add_unique(items, value):
    """
    Add value to a list only if it is not already present.
    """
    if value not in items:
        items.append(value)