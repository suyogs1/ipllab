; Hello World Example - Basic EduASM program
; Demonstrates string output and program termination

.DATA
msg: .STRING "Hello, World!"

.TEXT
start:
    MOV R1, msg     ; Load string address into R1
    SYS #2          ; Print string system call
    MOV R0, #0      ; Set exit code to 0
    SYS #3          ; Exit program system call
    HALT            ; Stop execution