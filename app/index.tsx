import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { Center } from "@/components/ui/center";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonText } from "@/components/ui/button";
import { Link, LinkText } from "@/components/ui/link";
import { useToast, Toast, ToastTitle } from "@/components/ui/toast";
import "@/global.css";
import { auth } from "@/firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function IndexScreen() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      toast.show({
        placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="error" variant="solid" className="mt-12">
              <ToastTitle>Please fill in both email and password.</ToastTitle>
            </Toast>
          );
        },
      });
      return;
    }
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/(tabs)"); // Navigate to home screen upon validation
    } catch (error: any) {
      toast.show({
        placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="error" variant="solid" className="mt-12">
              <ToastTitle>{error.message || "Failed to login"}</ToastTitle>
            </Toast>
          );
        },
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      className="bg-background-light dark:bg-background-dark"
    >
      <Center className="flex-1 w-full px-6">
        <VStack space="xl" className="w-full max-w-[400px]">
          <Center>
            <Heading size="3xl" className="text-primary-500 mb-2 text-center">
              Ambulance Navigator
            </Heading>
            <Text size="md" className="text-secondary-600 dark:text-typography-300 mb-8 text-center">
              Welcome back! Please login.
            </Text>
          </Center>

          <VStack space="md">
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Email</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </Input>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Password</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  placeholder="Enter your password"
                  type="password"
                  secureTextEntry={true}
                  value={password}
                  onChangeText={setPassword}
                />
              </Input>
            </FormControl>
          </VStack>

          <Button size="lg" onPress={handleLogin} className="mt-6">
            <ButtonText>Login</ButtonText>
          </Button>

          <Center className="flex-row items-center gap-1.5 mt-4">
            <Text className="text-secondary-800 dark:text-typography-300">Don't have an account?</Text>
            <Link onPress={() => router.push("/register")}>
              <LinkText className="text-primary-600 font-bold">Register</LinkText>
            </Link>
          </Center>
        </VStack>
      </Center>
    </KeyboardAvoidingView>
  );
}
