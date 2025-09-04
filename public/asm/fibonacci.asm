; Fibonacci Sequence - Calculate Nth Fibonacci number iteratively
; This program demonstrates iterative algorithms and variable management

.DATA
n: .WORD 10                    ; Calculate F(10) = 55

.TEXT
start:
    LOAD R0, [n]                ; Load N
    
    ; Handle base cases
    CMP R0, #0                  ; Check if N = 0
    JZ fib_zero                 ; F(0) = 0
    CMP R0, #1                  ; Check if N = 1
    JZ fib_one                  ; F(1) = 1
    
    ; Initialize for iteration
    MOV R1, #0                  ; F(0) = 0 (previous)
    MOV R2, #1                  ; F(1) = 1 (current)
    MOV R3, #2                  ; Counter starts at 2
    
fib_loop:
    CMP R3, R0                  ; Check if we've reached N
    JG fib_done                 ; Exit if counter > N
    
    ; Calculate next Fibonacci number
    MOV R4, R2                  ; Save current as temp
    ADD R2, R1                  ; current = current + previous
    MOV R1, R4                  ; previous = old current
    
    INC R3                      ; Increment counter
    JMP fib_loop                ; Continue loop
    
fib_done:
    MOV R0, R2                  ; Result is in R2
    JMP print_result            ; Jump to print
    
fib_zero:
    MOV R0, #0                  ; F(0) = 0
    JMP print_result            ; Jump to print
    
fib_one:
    MOV R0, #1                  ; F(1) = 1
    
print_result:
    SYS #1                      ; Print result
    MOV R0, #0                  ; Exit code 0
    SYS #3                      ; Exit program
    HALT

; Alternative recursive implementation (commented out)
; This would be less efficient but demonstrates recursion
;
; fib_recursive:
;     PUSH BP                   ; Save base pointer
;     MOV BP, SP                ; Set up stack frame
;     
;     CMP R0, #1                ; Check if N <= 1
;     JLE fib_base              ; Jump to base case
;     
;     ; Calculate F(N-1)
;     PUSH R0                   ; Save N
;     DEC R0                    ; N-1
;     CALL fib_recursive        ; Recursive call
;     POP R1                    ; Restore N, result in R0
;     PUSH R0                   ; Save F(N-1)
;     
;     ; Calculate F(N-2)
;     MOV R0, R1                ; Restore N
;     SUB R0, #2                ; N-2
;     CALL fib_recursive        ; Recursive call
;     POP R1                    ; Get F(N-1), F(N-2) in R0
;     ADD R0, R1                ; F(N-1) + F(N-2)
;     
;     MOV SP, BP                ; Restore stack
;     POP BP                    ; Restore base pointer
;     RET                       ; Return
;     
; fib_base:
;     ; R0 already contains N (0 or 1), which is the result
;     MOV SP, BP                ; Restore stack
;     POP BP                    ; Restore base pointer
;     RET                       ; Return