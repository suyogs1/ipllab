; Factorial (Iterative) - Calculate N! using stack for intermediate values
; This program demonstrates stack operations and iterative algorithms

.DATA
n: .WORD 5                     ; Calculate 5! = 120

.TEXT
start:
    LOAD R0, [n]                ; Load N into R0
    CMP R0, #0                  ; Check if N is 0
    JZ zero_factorial           ; Handle 0! = 1 case
    CMP R0, #1                  ; Check if N is 1
    JZ one_factorial            ; Handle 1! = 1 case
    
    ; Calculate N! iteratively using stack
    MOV R1, #1                  ; Initialize result to 1
    MOV R2, R0                  ; Copy N to R2 (counter)
    
factorial_loop:
    CMP R2, #1                  ; Check if counter reached 1
    JLE factorial_done          ; Done if counter <= 1
    
    PUSH R1                     ; Save current result on stack
    MUL R1, R2                  ; Multiply result by counter
    DEC R2                      ; Decrement counter
    JMP factorial_loop          ; Continue loop
    
factorial_done:
    MOV R0, R1                  ; Move result to R0
    JMP print_result            ; Jump to print
    
zero_factorial:
one_factorial:
    MOV R0, #1                  ; 0! = 1! = 1
    
print_result:
    ; R0 now contains N! (120 for N=5)
    SYS #1                      ; Print the result
    MOV R0, #0                  ; Exit code 0
    SYS #3                      ; Exit program
    HALT

; Alternative implementation using function call
factorial_function:
    ; Function to calculate factorial recursively using stack
    PUSH BP                     ; Save base pointer
    MOV BP, SP                  ; Set up stack frame
    
    CMP R0, #1                  ; Check if N <= 1
    JLE base_case               ; Jump to base case
    
    PUSH R0                     ; Save N on stack
    DEC R0                      ; N = N - 1
    CALL factorial_function     ; Recursive call
    POP R1                      ; Restore original N
    MUL R0, R1                  ; N * factorial(N-1)
    
    MOV SP, BP                  ; Restore stack pointer
    POP BP                      ; Restore base pointer
    RET                         ; Return to caller
    
base_case:
    MOV R0, #1                  ; Return 1 for base case
    MOV SP, BP                  ; Restore stack pointer
    POP BP                      ; Restore base pointer
    RET                         ; Return to caller