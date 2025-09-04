; Control Flow Example - Loops and conditionals
; Demonstrates array processing with branching logic

.DATA
numbers: .WORD 5, 3, 8, 1, 9
len: .WORD 5
max_val: .WORD 0

.TEXT
start:
    ; Find maximum value in array
    MOV R0, numbers     ; Array pointer
    LOAD R1, [R0]       ; Load first element as initial max
    STORE [max_val], R1 ; Store initial max
    LOAD R2, [len]      ; Load array length
    DEC R2              ; Adjust for first element already processed
    ADD R0, #4          ; Move to second element
    
loop:
    CMP R2, #0          ; Check if done
    JZ done             ; Jump if no more elements
    
    LOAD R3, [R0]       ; Load current element
    LOAD R4, [max_val]  ; Load current max
    CMP R3, R4          ; Compare current with max
    JLE skip            ; Jump if current <= max
    
    STORE [max_val], R3 ; Update max value
    
skip:
    ADD R0, #4          ; Move to next element
    DEC R2              ; Decrement counter
    JMP loop            ; Continue loop
    
done:
    LOAD R0, [max_val]  ; Load final max value
    SYS #1              ; Print result
    MOV R0, #0          ; Exit code
    SYS #3              ; Exit program
    HALT