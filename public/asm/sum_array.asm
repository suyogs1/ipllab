; Sum Array - Calculate sum of integers in an array
; This program demonstrates array iteration and accumulation

.DATA
len: .WORD 5                    ; Number of elements
data: .WORD 1, 2, 3, 4, 5      ; Array data

.TEXT
start:
    MOV R0, #0                  ; Initialize sum to 0
    MOV R1, data                ; Load array base address
    LOAD R2, [len]              ; Load array length
    
loop:
    CMP R2, #0                  ; Check if counter is zero
    JZ done                     ; Jump to done if finished
    
    LOAD R3, [R1]               ; Load current array element
    ADD R0, R3                  ; Add to sum
    ADD R1, #4                  ; Move to next element (4 bytes per WORD)
    DEC R2                      ; Decrement counter
    JMP loop                    ; Continue loop
    
done:
    ; R0 now contains the sum (15)
    SYS #1                      ; Print the result
    MOV R0, #0                  ; Exit code 0
    SYS #3                      ; Exit program
    HALT